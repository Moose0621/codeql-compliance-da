import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RealTimeStateManager,
  StateUpdateHandler,
  RepositoryUpdate,
  ScanStatusUpdate
} from '@/lib/realtime-state';
import type {
  AppState,
  Repository,
  ScanRequest,
  SecurityFindings,
  RealTimeEvent,
  WorkflowRunWebhookEvent,
  CodeScanningAlertWebhookEvent,
  PushWebhookEvent
} from '@/types/dashboard';

describe('realtime-state', () => {
  let stateManager: RealTimeStateManager;
  let mockRepositories: Repository[];
  let mockScanRequests: ScanRequest[];

  beforeEach(() => {
    vi.useFakeTimers();
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
        security_findings: { critical: 1, high: 2, medium: 3, low: 4, note: 5, total: 15 },
        workflow_dispatch_enabled: true,
        default_branch: 'main'
      },
      {
        id: 2,
        name: 'test-repo-2',
        full_name: 'org/test-repo-2',
        owner: { login: 'org', avatar_url: 'https://avatars.example.com/u/1' },
        has_codeql_workflow: false,
        last_scan_status: 'pending',
        workflow_dispatch_enabled: false,
        default_branch: 'main'
      }
    ];

    mockScanRequests = [
      {
        id: 'scan-1',
        repository: 'org/test-repo-1',
        timestamp: '2023-01-01T00:00:00Z',
        status: 'running'
      },
      {
        id: 'scan-2',
        repository: 'org/test-repo-2',
        timestamp: '2023-01-01T00:05:00Z',
        status: 'dispatched'
      }
    ];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization and basic state management', () => {
    it('should initialize with empty state', () => {
      const state = stateManager.getState();
      
      expect(state.repositories).toEqual([]);
      expect(state.scanRequests).toEqual([]);
      expect(state.isRealTimeConnected).toBe(false);
      expect(state.pendingUpdates).toBe(0);
      expect(state.lastUpdate).toBeTruthy();
    });

    it('should initialize state with provided data', () => {
      stateManager.initializeState(mockRepositories, mockScanRequests);
      
      const state = stateManager.getState();
      expect(state.repositories).toEqual(mockRepositories);
      expect(state.scanRequests).toEqual(mockScanRequests);
    });

    it('should update connection status', () => {
      const handler = vi.fn();
      stateManager.addStateHandler(handler);
      
      stateManager.updateConnectionStatus(true);
      
      expect(stateManager.getState().isRealTimeConnected).toBe(true);
      expect(handler).toHaveBeenCalledWith({ isRealTimeConnected: true });
    });

    it('should not notify handlers if connection status unchanged', () => {
      const handler = vi.fn();
      stateManager.addStateHandler(handler);
      
      // Set to false (current state)
      stateManager.updateConnectionStatus(false);
      
      expect(handler).not.toHaveBeenCalled();
    });

    it('should add and remove state handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      stateManager.addStateHandler(handler1);
      stateManager.addStateHandler(handler2);
      
      stateManager.updateConnectionStatus(true);
      
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      
      handler1.mockClear();
      handler2.mockClear();
      
      stateManager.removeStateHandler(handler1);
      stateManager.updateConnectionStatus(false);
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('event processing', () => {
    beforeEach(() => {
      stateManager.initializeState(mockRepositories, mockScanRequests);
    });

    it('should queue and batch process events', () => {
      const handler = vi.fn();
      stateManager.addStateHandler(handler);
      
      const event1: RealTimeEvent = {
        id: 'event-1',
        type: 'repository_update',
        timestamp: new Date().toISOString(),
        data: {
          repositoryId: 1,
          updates: { last_scan_status: 'in_progress' as const },
          timestamp: new Date().toISOString()
        } as RepositoryUpdate,
        source: 'webhook'
      };

      const event2: RealTimeEvent = {
        id: 'event-2',
        type: 'repository_update',
        timestamp: new Date().toISOString(),
        data: {
          repositoryId: 2,
          updates: { last_scan_status: 'success' as const },
          timestamp: new Date().toISOString()
        } as RepositoryUpdate,
        source: 'webhook'
      };

      // Queue events
      stateManager.processRealTimeEvent(event1);
      stateManager.processRealTimeEvent(event2);
      
      // Should not process immediately
      expect(handler).not.toHaveBeenCalled();
      
      // Advance timer to trigger batch processing
      vi.advanceTimersByTime(200);
      
      expect(handler).toHaveBeenCalled();
      
      const state = stateManager.getState();
      expect(state.repositories[0].last_scan_status).toBe('in_progress');
      expect(state.repositories[1].last_scan_status).toBe('success');
    });

    it('should process large queues immediately', () => {
      const handler = vi.fn();
      stateManager.addStateHandler(handler);
      
      // Add 10 events (batch size)
      for (let i = 0; i < 10; i++) {
        const event: RealTimeEvent = {
          id: `event-${i}`,
          type: 'repository_update',
          timestamp: new Date().toISOString(),
          data: {
            repositoryId: 1,
            updates: { last_scan_status: 'in_progress' as const },
            timestamp: new Date().toISOString()
          } as RepositoryUpdate,
          source: 'webhook'
        };
        
        stateManager.processRealTimeEvent(event);
      }
      
      // Should process immediately without timer advance
      expect(handler).toHaveBeenCalled();
    });

    it('should handle repository update events', () => {
      const handler = vi.fn();
      stateManager.addStateHandler(handler);
      
      const updateEvent: RealTimeEvent = {
        id: 'update-1',
        type: 'repository_update',
        timestamp: new Date().toISOString(),
        data: {
          repositoryId: 1,
          updates: {
            last_scan_status: 'failure' as const,
            security_findings: { critical: 2, high: 3, medium: 4, low: 5, note: 6, total: 20 }
          },
          timestamp: new Date().toISOString()
        } as RepositoryUpdate,
        source: 'webhook'
      };

      stateManager.processRealTimeEvent(updateEvent);
      stateManager.flush();

      const state = stateManager.getState();
      const updatedRepo = state.repositories.find(r => r.id === 1);
      
      expect(updatedRepo?.last_scan_status).toBe('failure');
      expect(updatedRepo?.security_findings?.total).toBe(20);
    });

    it('should handle scan status update events', () => {
      const handler = vi.fn();
      stateManager.addStateHandler(handler);
      
      const scanUpdate: RealTimeEvent = {
        id: 'scan-update-1',
        type: 'scan_status',
        timestamp: new Date().toISOString(),
        data: {
          repositoryName: 'org/test-repo-1',
          scanId: 'scan-1',
          status: 'completed' as const,
          timestamp: new Date().toISOString(),
          findings: { critical: 0, high: 1, medium: 2, low: 3, note: 4, total: 10 },
          duration: 300
        } as ScanStatusUpdate,
        source: 'webhook'
      };

      stateManager.processRealTimeEvent(scanUpdate);
      stateManager.flush();

      const state = stateManager.getState();
      const updatedScan = state.scanRequests.find(s => s.id === 'scan-1');
      const updatedRepo = state.repositories.find(r => r.full_name === 'org/test-repo-1');
      
      expect(updatedScan?.status).toBe('completed');
      expect(updatedScan?.duration).toBe(300);
      expect(updatedScan?.findings?.total).toBe(10);
      expect(updatedRepo?.last_scan_status).toBe('success');
      expect(updatedRepo?.security_findings?.total).toBe(10);
    });

    it('should handle security alert events', () => {
      const alertEvent: RealTimeEvent = {
        id: 'alert-1',
        type: 'security_alert',
        timestamp: new Date().toISOString(),
        data: {
          repository: 'org/test-repo-1',
          severity: 'critical',
          action: 'created'
        },
        source: 'webhook'
      };

      stateManager.processRealTimeEvent(alertEvent);
      stateManager.flush();

      const state = stateManager.getState();
      const updatedRepo = state.repositories.find(r => r.full_name === 'org/test-repo-1');
      
      expect(updatedRepo?.security_findings?.critical).toBe(2); // Was 1, now 2
      expect(updatedRepo?.security_findings?.total).toBe(16); // Was 15, now 16
    });

    it('should handle workflow run webhook events', () => {
      const webhookEvent: RealTimeEvent = {
        id: 'webhook-1',
        type: 'webhook_received',
        timestamp: new Date().toISOString(),
        data: {
          eventType: 'workflow_run',
          payload: {
            action: 'completed',
            repository: {
              id: 1,
              name: 'test-repo-1',
              full_name: 'org/test-repo-1',
              owner: { login: 'org', avatar_url: '' }
            },
            sender: { login: 'user', avatar_url: '' },
            workflow_run: {
              id: 123,
              name: 'CodeQL',
              status: 'completed',
              conclusion: 'success',
              created_at: '2023-01-01T12:00:00Z',
              updated_at: '2023-01-01T12:05:00Z',
              html_url: 'https://github.com/org/test-repo-1/actions/runs/123',
              run_number: 1,
              workflow_id: 456,
              head_commit: {
                id: 'abc123',
                message: 'Test commit',
                author: { name: 'user', email: 'user@example.com' }
              }
            }
          } as WorkflowRunWebhookEvent
        },
        source: 'webhook'
      };

      stateManager.processRealTimeEvent(webhookEvent);
      stateManager.flush();

      const state = stateManager.getState();
      const updatedRepo = state.repositories.find(r => r.id === 1);
      
      expect(updatedRepo?.last_scan_status).toBe('success');
      expect(updatedRepo?.last_scan_date).toBe('2023-01-01T12:05:00Z');
    });

    it('should handle code scanning alert webhook events', () => {
      const webhookEvent: RealTimeEvent = {
        id: 'webhook-alert-1',
        type: 'webhook_received',
        timestamp: new Date().toISOString(),
        data: {
          eventType: 'code_scanning_alert',
          payload: {
            action: 'created',
            repository: {
              id: 1,
              name: 'test-repo-1',
              full_name: 'org/test-repo-1',
              owner: { login: 'org', avatar_url: '' }
            },
            sender: { login: 'user', avatar_url: '' },
            alert: {
              number: 42,
              created_at: '2023-01-01T12:00:00Z',
              updated_at: '2023-01-01T12:00:00Z',
              dismissed_at: null,
              dismissed_by: null,
              dismissed_reason: null,
              rule: {
                id: 'sql-injection',
                severity: 'error',
                security_severity_level: 'high',
                description: 'SQL injection vulnerability'
              },
              state: 'open'
            }
          } as CodeScanningAlertWebhookEvent
        },
        source: 'webhook'
      };

      stateManager.processRealTimeEvent(webhookEvent);
      stateManager.flush();

      const state = stateManager.getState();
      const updatedRepo = state.repositories.find(r => r.id === 1);
      
      expect(updatedRepo?.security_findings?.high).toBe(3); // Was 2, now 3
      expect(updatedRepo?.security_findings?.total).toBe(16); // Was 15, now 16
    });

    it('should handle unknown event types gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const unknownEvent: RealTimeEvent = {
        id: 'unknown-1',
        type: 'unknown_event' as any,
        timestamp: new Date().toISOString(),
        data: { test: 'data' },
        source: 'webhook'
      };

      stateManager.processRealTimeEvent(unknownEvent);
      stateManager.flush();

      expect(consoleSpy).toHaveBeenCalledWith('Unknown event type:', 'unknown_event');
      consoleSpy.mockRestore();
    });

    it('should handle errors in event processing gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Add a handler that throws an error
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      stateManager.addStateHandler(errorHandler);

      const event: RealTimeEvent = {
        id: 'error-event',
        type: 'repository_update',
        timestamp: new Date().toISOString(),
        data: {
          repositoryId: 1,
          updates: { last_scan_status: 'success' as const },
          timestamp: new Date().toISOString()
        } as RepositoryUpdate,
        source: 'webhook'
      };

      stateManager.processRealTimeEvent(event);
      stateManager.flush();

      expect(consoleSpy).toHaveBeenCalledWith('Error in state handler:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('manual synchronization', () => {
    beforeEach(() => {
      stateManager.initializeState(mockRepositories, mockScanRequests);
    });

    it('should sync repository updates', () => {
      const handler = vi.fn();
      stateManager.addStateHandler(handler);
      
      const updatedRepos: Repository[] = [
        {
          ...mockRepositories[0],
          last_scan_status: 'failure',
          security_findings: { critical: 5, high: 4, medium: 3, low: 2, note: 1, total: 15 }
        },
        {
          ...mockRepositories[1],
          last_scan_status: 'success',
          last_scan_date: '2023-01-02T00:00:00Z'
        }
      ];

      stateManager.syncRepositories(updatedRepos);

      const state = stateManager.getState();
      expect(state.repositories[0].last_scan_status).toBe('failure');
      expect(state.repositories[0].security_findings?.critical).toBe(5);
      expect(state.repositories[1].last_scan_status).toBe('success');
      expect(state.repositories[1].last_scan_date).toBe('2023-01-02T00:00:00Z');
      
      expect(handler).toHaveBeenCalledWith({
        repositories: expect.arrayContaining([
          expect.objectContaining({ id: 1, last_scan_status: 'failure' }),
          expect.objectContaining({ id: 2, last_scan_status: 'success' })
        ])
      });
    });

    it('should not sync if no changes detected', () => {
      const handler = vi.fn();
      stateManager.addStateHandler(handler);
      
      // Sync with same data
      stateManager.syncRepositories(mockRepositories);
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('batch processing and queue management', () => {
    beforeEach(() => {
      stateManager.initializeState(mockRepositories, mockScanRequests);
    });

    it('should track pending updates count', () => {
      const handler = vi.fn();
      stateManager.addStateHandler(handler);
      
      // Add multiple events
      for (let i = 0; i < 5; i++) {
        const event: RealTimeEvent = {
          id: `event-${i}`,
          type: 'repository_update',
          timestamp: new Date().toISOString(),
          data: {
            repositoryId: 1,
            updates: { last_scan_status: 'in_progress' as const },
            timestamp: new Date().toISOString()
          } as RepositoryUpdate,
          source: 'webhook'
        };
        
        stateManager.processRealTimeEvent(event);
      }

      // Check pending count before processing
      expect(stateManager.getState().pendingUpdates).toBe(0); // Not yet updated

      // Trigger processing
      vi.advanceTimersByTime(200);

      // Verify processing completed
      const finalState = stateManager.getState();
      expect(finalState.pendingUpdates).toBe(0);
    });

    it('should handle continuous queue processing', () => {
      const handler = vi.fn();
      stateManager.addStateHandler(handler);
      
      // Add events that exceed batch size
      for (let i = 0; i < 25; i++) {
        const event: RealTimeEvent = {
          id: `event-${i}`,
          type: 'repository_update',
          timestamp: new Date().toISOString(),
          data: {
            repositoryId: 1,
            updates: { last_scan_status: 'in_progress' as const },
            timestamp: new Date().toISOString()
          } as RepositoryUpdate,
          source: 'webhook'
        };
        
        stateManager.processRealTimeEvent(event);
      }

      // Should process in batches
      vi.advanceTimersByTime(1000); // Allow all processing to complete
      
      const finalState = stateManager.getState();
      expect(finalState.pendingUpdates).toBe(0);
      expect(handler).toHaveBeenCalled();
    });

    it('should flush pending updates immediately', () => {
      const handler = vi.fn();
      stateManager.addStateHandler(handler);
      
      const event: RealTimeEvent = {
        id: 'flush-test',
        type: 'repository_update',
        timestamp: new Date().toISOString(),
        data: {
          repositoryId: 1,
          updates: { last_scan_status: 'completed' as const },
          timestamp: new Date().toISOString()
        } as RepositoryUpdate,
        source: 'webhook'
      };

      stateManager.processRealTimeEvent(event);
      
      // Should not have processed yet
      expect(handler).not.toHaveBeenCalled();
      
      // Flush should trigger immediate processing
      stateManager.flush();
      
      expect(handler).toHaveBeenCalled();
      
      const state = stateManager.getState();
      expect(state.repositories[0].last_scan_status).toBe('completed');
    });
  });

  describe('security findings updates', () => {
    beforeEach(() => {
      stateManager.initializeState(mockRepositories, mockScanRequests);
    });

    it('should correctly increment security findings', () => {
      const alertEvent: RealTimeEvent = {
        id: 'alert-increment',
        type: 'security_alert',
        timestamp: new Date().toISOString(),
        data: {
          repository: 'org/test-repo-1',
          severity: 'critical',
          action: 'created'
        },
        source: 'webhook'
      };

      stateManager.processRealTimeEvent(alertEvent);
      stateManager.flush();

      const state = stateManager.getState();
      const repo = state.repositories.find(r => r.full_name === 'org/test-repo-1');
      
      expect(repo?.security_findings?.critical).toBe(2); // 1 + 1
      expect(repo?.security_findings?.total).toBe(16); // 15 + 1
    });

    it('should correctly decrement security findings', () => {
      const alertEvent: RealTimeEvent = {
        id: 'alert-decrement',
        type: 'security_alert',
        timestamp: new Date().toISOString(),
        data: {
          repository: 'org/test-repo-1',
          severity: 'high',
          action: 'closed'
        },
        source: 'webhook'
      };

      stateManager.processRealTimeEvent(alertEvent);
      stateManager.flush();

      const state = stateManager.getState();
      const repo = state.repositories.find(r => r.full_name === 'org/test-repo-1');
      
      expect(repo?.security_findings?.high).toBe(1); // 2 - 1
      expect(repo?.security_findings?.total).toBe(14); // 15 - 1
    });

    it('should not allow negative security findings', () => {
      // First, reduce findings to zero
      const repo = mockRepositories[0];
      repo.security_findings = { critical: 0, high: 0, medium: 0, low: 0, note: 0, total: 0 };
      stateManager.initializeState([repo], []);

      const alertEvent: RealTimeEvent = {
        id: 'alert-negative',
        type: 'security_alert',
        timestamp: new Date().toISOString(),
        data: {
          repository: 'org/test-repo-1',
          severity: 'critical',
          action: 'closed'
        },
        source: 'webhook'
      };

      stateManager.processRealTimeEvent(alertEvent);
      stateManager.flush();

      const state = stateManager.getState();
      const updatedRepo = state.repositories.find(r => r.full_name === 'org/test-repo-1');
      
      expect(updatedRepo?.security_findings?.critical).toBe(0); // Should not go below 0
      expect(updatedRepo?.security_findings?.total).toBe(0);
    });
  });
});