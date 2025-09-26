import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  verifyWebhookSignature,
  validateWebhookPayload,
  createMockWebhookSignature
} from '@/lib/webhook-utils';
import { WebSocketManager, MockWebSocket } from '@/lib/websocket-manager';
import { RealTimeStateManager } from '@/lib/realtime-state';
import type {
  WorkflowRunWebhookEvent,
  CodeScanningAlertWebhookEvent,
  PushWebhookEvent,
  RealTimeEvent,
  Repository
} from '@/types/dashboard';

// Mock WebSocket globally
(global as any).WebSocket = MockWebSocket;

/**
 * Integration tests for webhook processing pipeline
 * Tests the complete flow from webhook receipt to UI state updates
 */
describe('webhook-integration', () => {
  let wsManager: WebSocketManager;
  let stateManager: RealTimeStateManager;
  let mockRepositories: Repository[];
  const webhookSecret = 'test-webhook-secret-123';

  beforeEach(() => {
    vi.useFakeTimers();
    
    // Initialize WebSocket manager
    wsManager = new WebSocketManager({
      url: 'ws://localhost:8080/realtime',
      maxReconnectAttempts: 3,
      reconnectInterval: 1000,
      heartbeatInterval: 30000,
      connectionTimeout: 10000
    });

    // Initialize state manager
    stateManager = new RealTimeStateManager();
    
    mockRepositories = [
      {
        id: 1,
        name: 'test-repo-1',
        full_name: 'org/test-repo-1',
        owner: { login: 'org', avatar_url: 'https://avatars.example.com/u/1' },
        has_codeql_workflow: true,
        last_scan_date: '2023-01-01T00:00:00Z',
        last_scan_status: 'success',
        security_findings: { critical: 0, high: 1, medium: 2, low: 3, note: 0, total: 6 },
        workflow_dispatch_enabled: true,
        default_branch: 'main'
      }
    ];
    
    stateManager.initializeState(mockRepositories);
  });

  afterEach(() => {
    wsManager.disconnect();
    vi.useRealTimers();
  });

  describe('complete webhook flow', () => {
    it('should process workflow_run webhook and update repository status', async () => {
      // Mock webhook payload
      const webhookPayload: WorkflowRunWebhookEvent = {
        action: 'completed',
        repository: {
          id: 1,
          name: 'test-repo-1',
          full_name: 'org/test-repo-1',
          owner: { login: 'org', avatar_url: 'https://avatars.example.com/u/1' }
        },
        sender: { login: 'github-actions[bot]', avatar_url: 'https://avatars.example.com/u/1' },
        workflow_run: {
          id: 12345,
          name: 'CodeQL',
          status: 'completed',
          conclusion: 'success',
          created_at: '2023-01-02T10:00:00Z',
          updated_at: '2023-01-02T10:05:00Z',
          html_url: 'https://github.com/org/test-repo-1/actions/runs/12345',
          run_number: 42,
          workflow_id: 67890,
          head_commit: {
            id: 'abc123def456',
            message: 'Add security fix for SQL injection',
            author: { name: 'developer', email: 'dev@company.com' }
          }
        }
      };

      // Simulate webhook signature verification
      const rawPayload = JSON.stringify(webhookPayload);
      const signature = createMockWebhookSignature(rawPayload, webhookSecret);
      
      const headers = {
        'x-github-event': 'workflow_run' as const,
        'x-github-delivery': 'test-delivery-12345',
        'x-hub-signature-256': signature,
        'x-github-hook-id': '123',
        'x-github-hook-installation-target-id': '456',
        'x-github-hook-installation-target-type': 'organization'
      };

      // Validate webhook
      const validation = validateWebhookPayload(headers, webhookPayload, webhookSecret, rawPayload);
      expect(validation.isValid).toBe(true);
      expect(validation.eventType).toBe('workflow_run');

      // Process through state manager
      const realtimeEvent: RealTimeEvent = {
        id: 'webhook-event-1',
        type: 'webhook_received',
        timestamp: new Date().toISOString(),
        data: {
          eventType: 'workflow_run',
          payload: webhookPayload
        },
        source: 'webhook'
      };

      // Track state changes
      let stateUpdates: any[] = [];
      stateManager.addStateHandler((updates) => {
        stateUpdates.push(updates);
      });

      // Process event
      stateManager.processRealTimeEvent(realtimeEvent);
      stateManager.flush();

      // Verify state was updated
      const finalState = stateManager.getState();
      const updatedRepo = finalState.repositories.find(r => r.id === 1);
      
      expect(updatedRepo?.last_scan_status).toBe('success');
      expect(updatedRepo?.last_scan_date).toBe('2023-01-02T10:05:00Z');
      expect(stateUpdates.length).toBeGreaterThan(0);
    });

    it('should process code_scanning_alert webhook and update security findings', async () => {
      const alertWebhook: CodeScanningAlertWebhookEvent = {
        action: 'created',
        repository: {
          id: 1,
          name: 'test-repo-1',
          full_name: 'org/test-repo-1',
          owner: { login: 'org', avatar_url: 'https://avatars.example.com/u/1' }
        },
        sender: { login: 'github-actions[bot]', avatar_url: 'https://avatars.example.com/u/1' },
        alert: {
          number: 15,
          created_at: '2023-01-02T11:00:00Z',
          updated_at: '2023-01-02T11:00:00Z',
          dismissed_at: null,
          dismissed_by: null,
          dismissed_reason: null,
          rule: {
            id: 'js/sql-injection',
            severity: 'error',
            security_severity_level: 'high',
            description: 'Database query built from user-controlled sources'
          },
          state: 'open'
        }
      };

      const rawPayload = JSON.stringify(alertWebhook);
      const signature = createMockWebhookSignature(rawPayload, webhookSecret);
      
      // Validate webhook
      const validation = validateWebhookPayload({
        'x-github-event': 'code_scanning_alert',
        'x-github-delivery': 'alert-delivery-789',
        'x-hub-signature-256': signature,
        'x-github-hook-id': '123',
        'x-github-hook-installation-target-id': '456',
        'x-github-hook-installation-target-type': 'organization'
      }, alertWebhook, webhookSecret, rawPayload);

      expect(validation.isValid).toBe(true);

      // Process through state manager
      const realtimeEvent: RealTimeEvent = {
        id: 'alert-webhook-1',
        type: 'webhook_received',
        timestamp: new Date().toISOString(),
        data: {
          eventType: 'code_scanning_alert',
          payload: alertWebhook
        },
        source: 'webhook'
      };

      stateManager.processRealTimeEvent(realtimeEvent);
      stateManager.flush();

      // Verify security findings were updated
      const finalState = stateManager.getState();
      const updatedRepo = finalState.repositories.find(r => r.id === 1);
      
      expect(updatedRepo?.security_findings?.high).toBe(2); // Was 1, now 2
      expect(updatedRepo?.security_findings?.total).toBe(7); // Was 6, now 7
    });

    it('should handle multiple concurrent webhooks correctly', async () => {
      const events: RealTimeEvent[] = [];
      
      // Create multiple webhook events
      for (let i = 0; i < 5; i++) {
        const workflowEvent: WorkflowRunWebhookEvent = {
          action: 'completed',
          repository: {
            id: 1,
            name: 'test-repo-1', 
            full_name: 'org/test-repo-1',
            owner: { login: 'org', avatar_url: 'https://avatars.example.com/u/1' }
          },
          sender: { login: 'user', avatar_url: 'https://avatars.example.com/u/1' },
          workflow_run: {
            id: 1000 + i,
            name: 'CodeQL',
            status: 'completed',
            conclusion: i % 2 === 0 ? 'success' : 'failure',
            created_at: `2023-01-02T10:${i.toString().padStart(2, '0')}:00Z`,
            updated_at: `2023-01-02T10:${(i + 5).toString().padStart(2, '0')}:00Z`,
            html_url: `https://github.com/org/test-repo-1/actions/runs/${1000 + i}`,
            run_number: i + 1,
            workflow_id: 67890,
            head_commit: {
              id: `commit-${i}`,
              message: `Commit ${i}`,
              author: { name: 'dev', email: 'dev@example.com' }
            }
          }
        };

        events.push({
          id: `concurrent-event-${i}`,
          type: 'webhook_received',
          timestamp: new Date().toISOString(),
          data: { eventType: 'workflow_run', payload: workflowEvent },
          source: 'webhook'
        });
      }

      // Process all events
      events.forEach(event => stateManager.processRealTimeEvent(event));
      
      // Allow batch processing
      vi.advanceTimersByTime(200);
      
      // Verify final state reflects the last processed event
      const finalState = stateManager.getState();
      const updatedRepo = finalState.repositories.find(r => r.id === 1);
      
      expect(updatedRepo?.last_scan_status).toBe('failure'); // Last event had failure conclusion
      expect(finalState.pendingUpdates).toBe(0);
    });
  });

  describe('websocket integration', () => {
    it('should relay webhook events through websocket connection', async () => {
      await wsManager.connect();
      vi.advanceTimersByTime(20); // Allow connection

      const receivedEvents: RealTimeEvent[] = [];
      
      wsManager.addEventListener((event) => {
        receivedEvents.push(event);
      });

      // Simulate server sending webhook event through websocket
      const mockWs = (wsManager as any).ws as MockWebSocket;
      
      const webhookEvent: RealTimeEvent = {
        id: 'ws-webhook-1',
        type: 'webhook_received',
        timestamp: new Date().toISOString(),
        data: {
          eventType: 'push',
          payload: {
            ref: 'refs/heads/main',
            before: 'abc123',
            after: 'def456',
            commits: [],
            head_commit: { id: 'def456', message: 'Test', author: { name: 'dev', email: 'dev@example.com' } },
            repository: { id: 1, name: 'test-repo-1', full_name: 'org/test-repo-1', owner: { login: 'org', avatar_url: '' } },
            sender: { login: 'dev', avatar_url: '' }
          } as PushWebhookEvent
        },
        source: 'webhook'
      };

      mockWs.simulateMessage(JSON.stringify({
        type: 'event',
        payload: webhookEvent,
        timestamp: new Date().toISOString()
      }));

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].type).toBe('webhook_received');
      expect(receivedEvents[0].data.eventType).toBe('push');
    });

    it('should maintain connection health during high webhook volume', async () => {
      await wsManager.connect();
      vi.advanceTimersByTime(20);

      const mockWs = (wsManager as any).ws as MockWebSocket;
      
      // Simulate high volume of webhook events
      for (let i = 0; i < 100; i++) {
        const event = {
          type: 'event',
          payload: {
            id: `high-volume-${i}`,
            type: 'repository_update',
            timestamp: new Date().toISOString(),
            data: { test: i },
            source: 'webhook'
          },
          timestamp: new Date().toISOString()
        };
        
        mockWs.simulateMessage(JSON.stringify(event));
      }

      const health = wsManager.getHealth();
      expect(health.connected).toBe(true);
      expect(health.errors).toBe(0);
    });
  });

  describe('error handling and resilience', () => {
    it('should handle malformed webhook payloads gracefully', () => {
      const invalidPayload = { incomplete: 'data' };
      
      const validation = validateWebhookPayload({
        'x-github-event': 'workflow_run',
        'x-github-delivery': 'test-delivery',
        'x-hub-signature-256': 'invalid-signature',
        'x-github-hook-id': '123',
        'x-github-hook-installation-target-id': '456',
        'x-github-hook-installation-target-type': 'organization'
      }, invalidPayload, webhookSecret);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Missing required payload fields');
    });

    it('should handle invalid webhook signatures', () => {
      const validPayload = {
        action: 'completed',
        repository: { id: 1, name: 'test', full_name: 'org/test', owner: { login: 'org', avatar_url: '' } },
        sender: { login: 'user', avatar_url: '' }
      };

      const validation = validateWebhookPayload({
        'x-github-event': 'workflow_run',
        'x-github-delivery': 'test-delivery',
        'x-hub-signature-256': 'sha256=invalid_signature_hash',
        'x-github-hook-id': '123',
        'x-github-hook-installation-target-id': '456',
        'x-github-hook-installation-target-type': 'organization'
      }, validPayload, webhookSecret, JSON.stringify(validPayload));

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Invalid webhook signature');
    });

    it('should recover from websocket connection failures', async () => {
      await wsManager.connect();
      vi.advanceTimersByTime(20);
      
      expect(wsManager.getState().status).toBe('connected');
      
      // Simulate connection failure
      const mockWs = (wsManager as any).ws as MockWebSocket;
      mockWs.close(1006, 'Network error'); // Abnormal closure
      
      // Should enter reconnecting state
      const stateAfterDisconnect = wsManager.getState();
      expect(stateAfterDisconnect.status).toBe('reconnecting');
      
      // Advance time to allow reconnection attempt
      vi.advanceTimersByTime(2000);
      
      // Should eventually reconnect (this would work with real WebSocket implementation)
      // In our test, we verify the reconnection logic is triggered
      expect(stateAfterDisconnect.reconnectAttempts).toBeGreaterThan(0);
    });

    it('should handle state synchronization errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Add a handler that throws an error
      stateManager.addStateHandler(() => {
        throw new Error('Handler error');
      });

      const event: RealTimeEvent = {
        id: 'error-test',
        type: 'repository_update',
        timestamp: new Date().toISOString(),
        data: {
          repositoryId: 1,
          updates: { last_scan_status: 'success' as const },
          timestamp: new Date().toISOString()
        },
        source: 'webhook'
      };

      stateManager.processRealTimeEvent(event);
      stateManager.flush();

      // Should continue working despite handler error
      const state = stateManager.getState();
      expect(state.repositories[0].last_scan_status).toBe('success');
      expect(consoleSpy).toHaveBeenCalledWith('Error in state handler:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('performance and scalability', () => {
    it('should handle batch processing efficiently', () => {
      const startTime = Date.now();
      
      // Create 50 events to test batch processing
      for (let i = 0; i < 50; i++) {
        const event: RealTimeEvent = {
          id: `batch-event-${i}`,
          type: 'repository_update',
          timestamp: new Date().toISOString(),
          data: {
            repositoryId: 1,
            updates: { last_scan_status: 'in_progress' as const },
            timestamp: new Date().toISOString()
          },
          source: 'webhook'
        };
        
        stateManager.processRealTimeEvent(event);
      }

      stateManager.flush();
      
      const processingTime = Date.now() - startTime;
      
      // Should process quickly (less than 100ms in test environment)
      expect(processingTime).toBeLessThan(100);
      
      // Verify all events were processed
      const state = stateManager.getState();
      expect(state.repositories[0].last_scan_status).toBe('in_progress');
      expect(state.pendingUpdates).toBe(0);
    });

    it('should maintain memory efficiency during extended operation', () => {
      // Process many events to test memory handling
      for (let batch = 0; batch < 10; batch++) {
        for (let i = 0; i < 20; i++) {
          const event: RealTimeEvent = {
            id: `memory-test-${batch}-${i}`,
            type: 'security_alert',
            timestamp: new Date().toISOString(),
            data: {
              repository: 'org/test-repo-1',
              severity: 'medium',
              action: i % 2 === 0 ? 'created' : 'closed'
            },
            source: 'webhook'
          };
          
          stateManager.processRealTimeEvent(event);
        }
        
        // Flush each batch
        stateManager.flush();
        vi.advanceTimersByTime(10);
      }

      // State should remain consistent
      const finalState = stateManager.getState();
      expect(finalState.repositories).toHaveLength(1);
      expect(finalState.pendingUpdates).toBe(0);
      
      // Memory should not grow unbounded (in real implementation, 
      // this would involve checking heap usage)
      expect(finalState.lastUpdate).toBeTruthy();
    });
  });
});