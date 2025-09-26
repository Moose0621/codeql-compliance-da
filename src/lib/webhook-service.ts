import type { 
  GitHubWorkflowEvent, 
  WebhookNotification, 
  RealtimeUpdate, 
  Repository, 
  ScanRequest, 
  SecurityFindings 
} from '@/types/dashboard';
import { GitHubService, createGitHubService } from './github-service';
import { logWarn, logError } from './logger';

/**
 * WebhookService handles GitHub webhook events for real-time updates
 * Provides signature verification, event processing, and client notification
 */
export class WebhookService {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private listeners: Map<string, Set<(update: RealtimeUpdate) => void>> = new Map();
  private connectionStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
  private statusListeners: Set<(status: string) => void> = new Set();
  
  constructor(private readonly webhookEndpoint: string = '/api/webhook/events') {
    // In a real implementation, webhookEndpoint would be the SSE endpoint
  }

  /**
   * Verify GitHub webhook signature using HMAC-SHA256
   * @param payload Raw webhook payload
   * @param signature GitHub signature header (x-hub-signature-256)
   * @param secret Webhook secret
   */
  static async verifySignature(
    payload: string, 
    signature: string, 
    secret: string
  ): Promise<boolean> {
    if (!signature.startsWith('sha256=')) {
      return false;
    }

    const sigHex = signature.slice(7);
    
    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signature_bytes = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(payload)
      );
      
      const expectedSig = Array.from(new Uint8Array(signature_bytes))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
        
      return expectedSig === sigHex;
    } catch (error) {
      logError('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Process GitHub workflow_run webhook event
   * @param event GitHub workflow event
   * @param githubService GitHub service instance for fetching additional data
   */
  async handleWorkflowEvent(event: GitHubWorkflowEvent, githubService?: GitHubService): Promise<void> {
    const { workflow_run, repository } = event;
    
    // Only process CodeQL workflow events
    if (!workflow_run.name.toLowerCase().includes('codeql') && 
        !workflow_run.path.includes('codeql')) {
      return;
    }

    logWarn(`Processing workflow event: ${workflow_run.name} - ${workflow_run.status} (${workflow_run.conclusion})`);

    try {
      const update: RealtimeUpdate = {
        type: 'repository_status',
        timestamp: new Date().toISOString(),
        data: {
          repositoryId: repository.id,
          status: this.mapWorkflowStatusToScanStatus(workflow_run.status, workflow_run.conclusion)
        }
      };

      // If workflow completed, fetch security findings
      if (workflow_run.status === 'completed' && githubService) {
        try {
          const findings = await githubService.getSecurityFindings(repository.name);
          update.data.findings = findings;
          
          // Create notification for critical findings
          if (findings.critical > 0 || findings.high > 0) {
            const notification: WebhookNotification = {
              id: `critical-${Date.now()}`,
              type: 'critical_finding',
              title: 'Critical Security Findings Detected',
              message: `${findings.critical + findings.high} critical/high severity issues found in ${repository.name}`,
              timestamp: new Date().toISOString(),
              repository: repository.full_name,
              severity: findings.critical > 0 ? 'error' : 'warning',
              data: { findings }
            };
            
            this.emitUpdate({
              type: 'notification',
              timestamp: new Date().toISOString(),
              data: { notification }
            });
          }
        } catch (error) {
          logError('Failed to fetch security findings after workflow completion:', error);
        }
      }

      this.emitUpdate(update);

      // Create scan completion notification
      if (workflow_run.status === 'completed') {
        const notification: WebhookNotification = {
          id: `scan-${workflow_run.id}`,
          type: workflow_run.conclusion === 'success' ? 'scan_completed' : 'scan_failed',
          title: workflow_run.conclusion === 'success' ? 'CodeQL Scan Completed' : 'CodeQL Scan Failed',
          message: `${repository.name}: ${workflow_run.name} ${workflow_run.conclusion}`,
          timestamp: new Date().toISOString(),
          repository: repository.full_name,
          severity: workflow_run.conclusion === 'success' ? 'success' : 'error',
          data: { workflow_run }
        };
        
        this.emitUpdate({
          type: 'notification',
          timestamp: new Date().toISOString(),
          data: { notification }
        });
      }
    } catch (error) {
      logError('Error handling workflow event:', error);
    }
  }

  /**
   * Connect to Server-Sent Events stream for real-time updates
   */
  connect(): void {
    if (this.eventSource?.readyState === EventSource.OPEN) {
      return; // Already connected
    }

    this.setConnectionStatus('connecting');
    
    try {
      this.eventSource = new EventSource(this.webhookEndpoint, {
        withCredentials: true
      });

      this.eventSource.onopen = () => {
        logWarn('Webhook SSE connection established');
        this.setConnectionStatus('connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      };

      this.eventSource.onmessage = (event) => {
        try {
          const update: RealtimeUpdate = JSON.parse(event.data);
          this.emitUpdate(update);
        } catch (error) {
          logError('Failed to parse SSE message:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        logError('SSE connection error:', error);
        this.setConnectionStatus('disconnected');
        this.scheduleReconnect();
      };

      // Handle different message types
      this.eventSource.addEventListener('workflow_completed', (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emitUpdate({
            type: 'scan_completion',
            timestamp: new Date().toISOString(),
            data
          });
        } catch (error) {
          logError('Failed to parse workflow_completed event:', error);
        }
      });

    } catch (error) {
      logError('Failed to establish SSE connection:', error);
      this.setConnectionStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from SSE stream
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.setConnectionStatus('disconnected');
    this.reconnectAttempts = 0;
  }

  /**
   * Subscribe to real-time updates
   * @param type Update type to listen for
   * @param callback Callback function
   */
  subscribe(type: string, callback: (update: RealtimeUpdate) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(type);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(type);
        }
      }
    };
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionStatusChange(callback: (status: string) => void): () => void {
    this.statusListeners.add(callback);
    // Immediately call with current status
    callback(this.connectionStatus);
    
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): string {
    return this.connectionStatus;
  }

  /**
   * Manually trigger a webhook processing (for testing)
   * @param event GitHub workflow event
   * @param githubToken GitHub token for API calls
   * @param organization GitHub organization
   */
  async processWebhookEvent(
    event: GitHubWorkflowEvent, 
    githubToken?: string, 
    organization?: string
  ): Promise<void> {
    let githubService: GitHubService | undefined;
    
    if (githubToken && organization) {
      githubService = createGitHubService(githubToken, organization);
    }
    
    await this.handleWorkflowEvent(event, githubService);
  }

  // Private methods

  private mapWorkflowStatusToScanStatus(
    status: string, 
    conclusion: string | null
  ): Repository['last_scan_status'] {
    if (status === 'completed') {
      return conclusion === 'success' ? 'success' : 'failure';
    }
    if (status === 'in_progress') {
      return 'in_progress';
    }
    return 'pending';
  }

  private emitUpdate(update: RealtimeUpdate): void {
    // Emit to type-specific listeners
    const typeListeners = this.listeners.get(update.type);
    if (typeListeners) {
      typeListeners.forEach(callback => {
        try {
          callback(update);
        } catch (error) {
          logError('Error in update callback:', error);
        }
      });
    }

    // Emit to 'all' listeners
    const allListeners = this.listeners.get('all');
    if (allListeners) {
      allListeners.forEach(callback => {
        try {
          callback(update);
        } catch (error) {
          logError('Error in update callback:', error);
        }
      });
    }
  }

  private setConnectionStatus(status: typeof this.connectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.statusListeners.forEach(callback => {
        try {
          callback(status);
        } catch (error) {
          logError('Error in status callback:', error);
        }
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logError('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    logWarn(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.connectionStatus === 'disconnected') {
        this.connect();
      }
    }, delay);
  }
}

// Singleton instance for app-wide use
let webhookServiceInstance: WebhookService | null = null;

export function getWebhookService(webhookEndpoint: string = '/api/webhook/events'): WebhookService {
  if (!webhookServiceInstance) {
    webhookServiceInstance = new WebhookService(webhookEndpoint);
  }
  return webhookServiceInstance;
}

export function resetWebhookService(): void {
  if (webhookServiceInstance) {
    webhookServiceInstance.disconnect();
    webhookServiceInstance = null;
  }
}