import type {
  RealTimeEvent,
  Repository,
  SecurityFindings,
  ScanRequest,
  WorkflowRunWebhookEvent,
  CodeScanningAlertWebhookEvent,
  PushWebhookEvent
} from '@/types/dashboard';

/**
 * Real-time state synchronization utilities
 * Manages UI state updates from webhook events and WebSocket messages
 */

export type StateUpdateHandler = (updates: Partial<AppState>) => void;

export interface AppState {
  repositories: Repository[];
  scanRequests: ScanRequest[];
  lastUpdate: string;
  isRealTimeConnected: boolean;
  pendingUpdates: number;
}

export interface RepositoryUpdate {
  repositoryId: number;
  updates: Partial<Repository>;
  timestamp: string;
}

export interface ScanStatusUpdate {
  repositoryName: string;
  scanId: string;
  status: ScanRequest['status'];
  timestamp: string;
  findings?: SecurityFindings;
  duration?: number;
}

export class RealTimeStateManager {
  private state: AppState = {
    repositories: [],
    scanRequests: [],
    lastUpdate: new Date().toISOString(),
    isRealTimeConnected: false,
    pendingUpdates: 0
  };

  private stateHandlers: Set<StateUpdateHandler> = new Set();
  private updateQueue: RealTimeEvent[] = [];
  private isProcessingQueue = false;
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly batchSize = 10;
  private readonly batchDelayMs = 100;

  /**
   * Initializes state with repository data
   */
  initializeState(repositories: Repository[], scanRequests: ScanRequest[] = []): void {
    this.state = {
      ...this.state,
      repositories,
      scanRequests,
      lastUpdate: new Date().toISOString()
    };
    
    this.notifyHandlers({ repositories, scanRequests });
  }

  /**
   * Processes real-time event and updates state accordingly
   */
  processRealTimeEvent(event: RealTimeEvent): void {
    this.updateQueue.push(event);
    this.scheduleQueueProcessing();
  }

  /**
   * Updates connection status
   */
  updateConnectionStatus(connected: boolean): void {
    if (this.state.isRealTimeConnected !== connected) {
      this.state = { ...this.state, isRealTimeConnected: connected };
      this.notifyHandlers({ isRealTimeConnected: connected });
    }
  }

  /**
   * Gets current state
   */
  getState(): AppState {
    return { ...this.state };
  }

  /**
   * Adds state change handler
   */
  addStateHandler(handler: StateUpdateHandler): void {
    this.stateHandlers.add(handler);
  }

  /**
   * Removes state change handler
   */
  removeStateHandler(handler: StateUpdateHandler): void {
    this.stateHandlers.delete(handler);
  }

  /**
   * Manually sync repository data (fallback when real-time fails)
   */
  syncRepositories(repositories: Repository[]): void {
    const updates = this.mergeRepositoryUpdates(repositories);
    if (updates.length > 0) {
      this.state = { 
        ...this.state, 
        repositories: this.state.repositories.map(repo => {
          const update = updates.find(u => u.id === repo.id);
          return update ? { ...repo, ...update } : repo;
        }),
        lastUpdate: new Date().toISOString()
      };
      
      this.notifyHandlers({ repositories: this.state.repositories });
    }
  }

  /**
   * Forces immediate processing of pending updates
   */
  flush(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.processQueue();
  }

  private scheduleQueueProcessing(): void {
    if (this.isProcessingQueue) {
      return;
    }

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    // Process immediately if queue is large, otherwise batch
    if (this.updateQueue.length >= this.batchSize) {
      this.processQueue();
    } else {
      this.batchTimeout = setTimeout(() => {
        this.processQueue();
      }, this.batchDelayMs);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    this.batchTimeout = null;

    try {
      const eventsToProcess = this.updateQueue.splice(0, this.batchSize);
      const stateUpdates: Partial<AppState> = { pendingUpdates: this.updateQueue.length };

      for (const event of eventsToProcess) {
        const updates = this.processEvent(event);
        this.mergeStateUpdates(stateUpdates, updates);
      }

      if (Object.keys(stateUpdates).length > 1) { // More than just pendingUpdates
        stateUpdates.lastUpdate = new Date().toISOString();
        this.applyStateUpdates(stateUpdates);
      }

      // Continue processing if queue has more items
      if (this.updateQueue.length > 0) {
        setTimeout(() => {
          this.isProcessingQueue = false;
          this.scheduleQueueProcessing();
        }, 10);
      } else {
        this.isProcessingQueue = false;
      }
    } catch (error) {
      console.error('Error processing real-time events:', error);
      this.isProcessingQueue = false;
    }
  }

  private processEvent(event: RealTimeEvent): Partial<AppState> {
    switch (event.type) {
      case 'repository_update':
        return this.processRepositoryUpdate(event);
      
      case 'scan_status':
        return this.processScanStatusUpdate(event);
      
      case 'security_alert':
        return this.processSecurityAlert(event);
      
      case 'webhook_received':
        return this.processWebhookEvent(event);
      
      default:
        console.warn('Unknown event type:', event.type);
        return {};
    }
  }

  private processRepositoryUpdate(event: RealTimeEvent): Partial<AppState> {
    const update = event.data as RepositoryUpdate;
    
    const updatedRepositories = this.state.repositories.map(repo => {
      if (repo.id === update.repositoryId) {
        return { ...repo, ...update.updates };
      }
      return repo;
    });

    return { repositories: updatedRepositories };
  }

  private processScanStatusUpdate(event: RealTimeEvent): Partial<AppState> {
    const update = event.data as ScanStatusUpdate;
    
    // Update scan requests
    const updatedScanRequests = this.state.scanRequests.map(scan => {
      if (scan.id === update.scanId) {
        return {
          ...scan,
          status: update.status,
          duration: update.duration,
          findings: update.findings
        };
      }
      return scan;
    });

    // Update repository scan status if available
    const updatedRepositories = this.state.repositories.map(repo => {
      if (repo.name === update.repositoryName || repo.full_name === update.repositoryName) {
        return {
          ...repo,
          last_scan_status: update.status === 'completed' ? 'success' : 
                           update.status === 'failed' ? 'failure' :
                           update.status === 'running' ? 'in_progress' : repo.last_scan_status,
          last_scan_date: update.status === 'completed' ? update.timestamp : repo.last_scan_date,
          security_findings: update.findings || repo.security_findings
        };
      }
      return repo;
    });

    return {
      scanRequests: updatedScanRequests,
      repositories: updatedRepositories
    };
  }

  private processSecurityAlert(event: RealTimeEvent): Partial<AppState> {
    const alertData = event.data;
    
    // Update repository security findings if we can identify the repository
    if (alertData.repository) {
      const updatedRepositories = this.state.repositories.map(repo => {
        if (repo.full_name === alertData.repository || repo.name === alertData.repository) {
          const currentFindings = repo.security_findings || { critical: 0, high: 0, medium: 0, low: 0, note: 0, total: 0 };
          
          // Increment appropriate severity counter based on alert severity
          const updatedFindings = this.updateSecurityFindings(currentFindings, alertData);
          
          return {
            ...repo,
            security_findings: updatedFindings
          };
        }
        return repo;
      });

      return { repositories: updatedRepositories };
    }

    return {};
  }

  private processWebhookEvent(event: RealTimeEvent): Partial<AppState> {
    const webhookData = event.data;
    
    switch (webhookData.eventType) {
      case 'workflow_run':
        return this.processWorkflowRunWebhook(webhookData.payload as WorkflowRunWebhookEvent);
      
      case 'code_scanning_alert':
        return this.processCodeScanningAlertWebhook(webhookData.payload as CodeScanningAlertWebhookEvent);
      
      case 'push':
        return this.processPushWebhook(webhookData.payload as PushWebhookEvent);
      
      default:
        return {};
    }
  }

  private processWorkflowRunWebhook(webhook: WorkflowRunWebhookEvent): Partial<AppState> {
    const repoFullName = webhook.repository.full_name;
    
    const updatedRepositories = this.state.repositories.map(repo => {
      if (repo.full_name === repoFullName) {
        return {
          ...repo,
          last_scan_status: webhook.workflow_run.conclusion === 'success' ? 'success' :
                           webhook.workflow_run.conclusion === 'failure' ? 'failure' :
                           webhook.workflow_run.status === 'in_progress' ? 'in_progress' :
                           webhook.workflow_run.status === 'queued' ? 'pending' : repo.last_scan_status,
          last_scan_date: webhook.workflow_run.conclusion ? webhook.workflow_run.updated_at : repo.last_scan_date
        };
      }
      return repo;
    });

    return { repositories: updatedRepositories };
  }

  private processCodeScanningAlertWebhook(webhook: CodeScanningAlertWebhookEvent): Partial<AppState> {
    const repoFullName = webhook.repository.full_name;
    
    const updatedRepositories = this.state.repositories.map(repo => {
      if (repo.full_name === repoFullName) {
        const currentFindings = repo.security_findings || { critical: 0, high: 0, medium: 0, low: 0, note: 0, total: 0 };
        const updatedFindings = this.updateSecurityFindingsFromAlert(currentFindings, webhook);
        
        return {
          ...repo,
          security_findings: updatedFindings
        };
      }
      return repo;
    });

    return { repositories: updatedRepositories };
  }

  private processPushWebhook(webhook: PushWebhookEvent): Partial<AppState> {
    const repoFullName = webhook.repository.full_name;
    
    // Push events might trigger new scans, so we could update last activity
    const updatedRepositories = this.state.repositories.map(repo => {
      if (repo.full_name === repoFullName) {
        return {
          ...repo,
          // Could set last_activity_date or trigger scan status update
        };
      }
      return repo;
    });

    return { repositories: updatedRepositories };
  }

  private updateSecurityFindings(findings: SecurityFindings, alertData: any): SecurityFindings {
    const severity = alertData.severity || 'medium';
    const isNewAlert = alertData.action === 'created' || alertData.action === 'reopened';
    const delta = isNewAlert ? 1 : -1;
    
    const updated = { ...findings };
    
    switch (severity) {
      case 'critical':
        updated.critical = Math.max(0, updated.critical + delta);
        break;
      case 'high':
        updated.high = Math.max(0, updated.high + delta);
        break;
      case 'medium':
        updated.medium = Math.max(0, updated.medium + delta);
        break;
      case 'low':
        updated.low = Math.max(0, updated.low + delta);
        break;
      case 'note':
        updated.note = Math.max(0, updated.note + delta);
        break;
    }
    
    updated.total = updated.critical + updated.high + updated.medium + updated.low + updated.note;
    return updated;
  }

  private updateSecurityFindingsFromAlert(findings: SecurityFindings, webhook: CodeScanningAlertWebhookEvent): SecurityFindings {
    const severity = webhook.alert.rule.security_severity_level || 
                    (webhook.alert.rule.severity === 'error' ? 'high' :
                     webhook.alert.rule.severity === 'warning' ? 'medium' : 'low');
    
    const isIncrease = webhook.action === 'created' || webhook.action === 'reopened' || webhook.action === 'appeared_in_branch';
    const delta = isIncrease ? 1 : -1;
    
    return this.updateSecurityFindings(findings, { severity, action: isIncrease ? 'created' : 'closed' });
  }

  private mergeRepositoryUpdates(newRepositories: Repository[]): Partial<Repository>[] {
    return newRepositories.map(newRepo => {
      const existing = this.state.repositories.find(r => r.id === newRepo.id);
      if (!existing) return newRepo;
      
      // Compare and return only changed fields
      const changes: Partial<Repository> = {};
      
      if (existing.last_scan_status !== newRepo.last_scan_status) {
        changes.last_scan_status = newRepo.last_scan_status;
      }
      if (existing.last_scan_date !== newRepo.last_scan_date) {
        changes.last_scan_date = newRepo.last_scan_date;
      }
      if (JSON.stringify(existing.security_findings) !== JSON.stringify(newRepo.security_findings)) {
        changes.security_findings = newRepo.security_findings;
      }
      
      return Object.keys(changes).length > 0 ? { id: newRepo.id, ...changes } : null;
    }).filter(Boolean) as Partial<Repository>[];
  }

  private mergeStateUpdates(target: Partial<AppState>, source: Partial<AppState>): void {
    Object.keys(source).forEach(key => {
      if (key === 'repositories' && target.repositories && source.repositories) {
        // Merge repository arrays
        const merged = [...target.repositories];
        source.repositories.forEach(sourceRepo => {
          const index = merged.findIndex(r => r.id === sourceRepo.id);
          if (index >= 0) {
            merged[index] = sourceRepo;
          } else {
            merged.push(sourceRepo);
          }
        });
        target.repositories = merged;
      } else if (key === 'scanRequests' && target.scanRequests && source.scanRequests) {
        // Merge scan request arrays
        const merged = [...target.scanRequests];
        source.scanRequests.forEach(sourceScan => {
          const index = merged.findIndex(s => s.id === sourceScan.id);
          if (index >= 0) {
            merged[index] = sourceScan;
          } else {
            merged.push(sourceScan);
          }
        });
        target.scanRequests = merged;
      } else {
        (target as any)[key] = (source as any)[key];
      }
    });
  }

  private applyStateUpdates(updates: Partial<AppState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyHandlers(updates);
  }

  private notifyHandlers(updates: Partial<AppState>): void {
    this.stateHandlers.forEach(handler => {
      try {
        handler(updates);
      } catch (error) {
        console.error('Error in state handler:', error);
      }
    });
  }
}

/**
 * Hook for using real-time state management in React components
 */
export function useRealTimeState(initialRepositories: Repository[] = [], initialScanRequests: ScanRequest[] = []) {
  const managerRef = React.useRef<RealTimeStateManager | null>(null);
  const [state, setState] = React.useState<AppState>({
    repositories: initialRepositories,
    scanRequests: initialScanRequests,
    lastUpdate: new Date().toISOString(),
    isRealTimeConnected: false,
    pendingUpdates: 0
  });

  React.useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = new RealTimeStateManager();
      managerRef.current.initializeState(initialRepositories, initialScanRequests);
      
      const handler = (updates: Partial<AppState>) => {
        setState(prevState => ({ ...prevState, ...updates }));
      };
      
      managerRef.current.addStateHandler(handler);
      
      return () => {
        managerRef.current?.removeStateHandler(handler);
      };
    }
  }, []);

  const processEvent = React.useCallback((event: RealTimeEvent) => {
    managerRef.current?.processRealTimeEvent(event);
  }, []);

  const updateConnectionStatus = React.useCallback((connected: boolean) => {
    managerRef.current?.updateConnectionStatus(connected);
  }, []);

  const syncRepositories = React.useCallback((repositories: Repository[]) => {
    managerRef.current?.syncRepositories(repositories);
  }, []);

  const flush = React.useCallback(() => {
    managerRef.current?.flush();
  }, []);

  return {
    state,
    processEvent,
    updateConnectionStatus,
    syncRepositories,
    flush,
    manager: managerRef.current
  };
}

// For non-React environments
let React: any;
try {
  React = require('react');
} catch (e) {
  // React not available
}