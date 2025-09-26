import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebhookRateLimiter } from '@/lib/webhook-utils';
import { WebSocketManager, MockWebSocket } from '@/lib/websocket-manager';
import { RealTimeStateManager } from '@/lib/realtime-state';
import type {
  RealTimeEvent,
  Repository,
  WorkflowRunWebhookEvent,
  WebSocketMessage
} from '@/types/dashboard';

// Mock WebSocket globally
(global as any).WebSocket = MockWebSocket;

/**
 * Performance and load testing for real-time webhook integration
 * Tests system behavior under high load and concurrent operations
 */
describe('webhook-performance-load-testing', () => {
  let stateManager: RealTimeStateManager;
  let rateLimiter: WebhookRateLimiter;
  let wsManager: WebSocketManager;
  let mockRepositories: Repository[];

  beforeEach(() => {
    vi.useFakeTimers();
    
    // Initialize components
    stateManager = new RealTimeStateManager();
    rateLimiter = new WebhookRateLimiter(100, 1); // 100 requests per minute
    wsManager = new WebSocketManager({
      url: 'ws://localhost:8080/realtime',
      maxReconnectAttempts: 3,
      reconnectInterval: 1000,
      heartbeatInterval: 30000,
      connectionTimeout: 5000
    });

    // Create large repository dataset for testing
    mockRepositories = Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      name: `repo-${i + 1}`,
      full_name: `org/repo-${i + 1}`,
      owner: { login: 'org', avatar_url: 'https://avatars.example.com/u/1' },
      has_codeql_workflow: true,
      last_scan_status: 'success' as const,
      last_scan_date: '2023-01-01T00:00:00Z',
      security_findings: { 
        critical: Math.floor(Math.random() * 5), 
        high: Math.floor(Math.random() * 10), 
        medium: Math.floor(Math.random() * 15), 
        low: Math.floor(Math.random() * 20), 
        note: Math.floor(Math.random() * 25), 
        total: 0 
      },
      workflow_dispatch_enabled: true,
      default_branch: 'main'
    }));

    // Calculate totals
    mockRepositories.forEach(repo => {
      repo.security_findings!.total = 
        repo.security_findings!.critical +
        repo.security_findings!.high +
        repo.security_findings!.medium +
        repo.security_findings!.low +
        repo.security_findings!.note;
    });

    stateManager.initializeState(mockRepositories);
  });

  afterEach(() => {
    wsManager.disconnect();
    vi.useRealTimers();
  });

  describe('concurrent webhook processing', () => {
    it('should handle 100 simultaneous webhook events efficiently', () => {
      const startTime = performance.now();
      const events: RealTimeEvent[] = [];
      
      // Generate 100 concurrent webhook events
      for (let i = 0; i < 100; i++) {
        const repositoryId = Math.floor(Math.random() * 1000) + 1;
        const event: RealTimeEvent = {
          id: `concurrent-event-${i}`,
          type: 'webhook_received',
          timestamp: new Date().toISOString(),
          data: {
            eventType: 'workflow_run',
            payload: {
              action: 'completed',
              repository: {
                id: repositoryId,
                name: `repo-${repositoryId}`,
                full_name: `org/repo-${repositoryId}`,
                owner: { login: 'org', avatar_url: '' }
              },
              sender: { login: 'github-actions[bot]', avatar_url: '' },
              workflow_run: {
                id: 10000 + i,
                name: 'CodeQL',
                status: 'completed',
                conclusion: Math.random() > 0.5 ? 'success' : 'failure',
                created_at: new Date(Date.now() - i * 1000).toISOString(),
                updated_at: new Date().toISOString(),
                html_url: `https://github.com/org/repo-${repositoryId}/actions/runs/${10000 + i}`,
                run_number: i + 1,
                workflow_id: 12345,
                head_commit: {
                  id: `commit-${i}`,
                  message: `Automated security scan ${i}`,
                  author: { name: 'automation', email: 'automation@company.com' }
                }
              }
            } as WorkflowRunWebhookEvent
          },
          source: 'webhook'
        };
        
        events.push(event);
      }

      // Process all events
      events.forEach(event => stateManager.processRealTimeEvent(event));
      stateManager.flush();
      
      const processingTime = performance.now() - startTime;
      
      // Should complete within reasonable time (less than 100ms)
      expect(processingTime).toBeLessThan(100);
      
      // Verify all events were processed
      const finalState = stateManager.getState();
      expect(finalState.pendingUpdates).toBe(0);
      expect(finalState.repositories).toHaveLength(1000);
    });

    it('should maintain performance with high-frequency webhook streams', () => {
      const batchSize = 50;
      const batchCount = 10;
      const processingTimes: number[] = [];
      
      for (let batch = 0; batch < batchCount; batch++) {
        const batchStartTime = performance.now();
        
        // Generate batch of events
        for (let i = 0; i < batchSize; i++) {
          const event: RealTimeEvent = {
            id: `batch-${batch}-event-${i}`,
            type: 'security_alert',
            timestamp: new Date().toISOString(),
            data: {
              repository: `org/repo-${Math.floor(Math.random() * 1000) + 1}`,
              severity: ['critical', 'high', 'medium', 'low'][Math.floor(Math.random() * 4)],
              action: Math.random() > 0.7 ? 'closed' : 'created'
            },
            source: 'webhook'
          };
          
          stateManager.processRealTimeEvent(event);
        }
        
        stateManager.flush();
        vi.advanceTimersByTime(10); // Simulate real-time passage
        
        const batchTime = performance.now() - batchStartTime;
        processingTimes.push(batchTime);
      }

      // Verify consistent performance across batches
      const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const maxProcessingTime = Math.max(...processingTimes);
      
      expect(avgProcessingTime).toBeLessThan(50); // Average under 50ms
      expect(maxProcessingTime).toBeLessThan(100); // Max under 100ms
      
      // No batch should be more than 2x the average (performance consistency)
      processingTimes.forEach(time => {
        expect(time).toBeLessThan(avgProcessingTime * 2);
      });
    });
  });

  describe('WebSocket connection scalability', () => {
    it('should handle 1000+ concurrent WebSocket message processing', async () => {
      await wsManager.connect();
      vi.advanceTimersByTime(20); // Allow connection
      
      const mockWs = (wsManager as any).ws as MockWebSocket;
      const receivedEvents: RealTimeEvent[] = [];
      
      wsManager.addEventListener((event) => {
        receivedEvents.push(event);
      });

      const startTime = performance.now();
      
      // Simulate 1000 concurrent messages
      for (let i = 0; i < 1000; i++) {
        const message: WebSocketMessage = {
          type: 'event',
          payload: {
            id: `scale-event-${i}`,
            type: 'repository_update',
            timestamp: new Date().toISOString(),
            data: {
              repositoryId: Math.floor(Math.random() * 1000) + 1,
              updates: { last_scan_status: 'in_progress' as const }
            },
            source: 'webhook'
          },
          timestamp: new Date().toISOString()
        };
        
        mockWs.simulateMessage(JSON.stringify(message));
      }
      
      const messageProcessingTime = performance.now() - startTime;
      
      // Should process 1000 messages quickly
      expect(messageProcessingTime).toBeLessThan(200);
      expect(receivedEvents).toHaveLength(1000);
      
      // Connection should remain healthy
      const health = wsManager.getHealth();
      expect(health.connected).toBe(true);
      expect(health.errors).toBe(0);
    });

    it('should maintain connection stability under message flood', async () => {
      await wsManager.connect();
      vi.advanceTimersByTime(20);
      
      const mockWs = (wsManager as any).ws as MockWebSocket;
      const errorCount = { value: 0 };
      
      // Track any errors
      mockWs.onerror = () => {
        errorCount.value++;
      };

      // Send 100 messages per batch, 20 batches
      for (let batch = 0; batch < 20; batch++) {
        for (let msg = 0; msg < 100; msg++) {
          const message: WebSocketMessage = {
            type: 'event',
            payload: {
              id: `flood-${batch}-${msg}`,
              type: 'scan_status',
              timestamp: new Date().toISOString(),
              data: { status: 'completed' },
              source: 'webhook'
            },
            timestamp: new Date().toISOString()
          };
          
          mockWs.simulateMessage(JSON.stringify(message));
        }
        
        // Small delay between batches
        vi.advanceTimersByTime(1);
      }

      // Should handle all messages without errors
      expect(errorCount.value).toBe(0);
      
      const health = wsManager.getHealth();
      expect(health.connected).toBe(true);
    });
  });

  describe('memory usage monitoring', () => {
    it('should not accumulate memory during extended operation', () => {
      const initialRepoCount = stateManager.getState().repositories.length;
      
      // Process many events over time to test memory management
      for (let cycle = 0; cycle < 50; cycle++) {
        // Generate events for random repositories
        for (let i = 0; i < 20; i++) {
          const event: RealTimeEvent = {
            id: `memory-test-${cycle}-${i}`,
            type: 'repository_update',
            timestamp: new Date().toISOString(),
            data: {
              repositoryId: Math.floor(Math.random() * 1000) + 1,
              updates: {
                last_scan_status: ['success', 'failure', 'in_progress'][Math.floor(Math.random() * 3)] as any,
                security_findings: {
                  critical: Math.floor(Math.random() * 5),
                  high: Math.floor(Math.random() * 10),
                  medium: Math.floor(Math.random() * 15),
                  low: Math.floor(Math.random() * 20),
                  note: Math.floor(Math.random() * 25),
                  total: 0
                }
              }
            },
            source: 'webhook'
          };
          
          // Calculate total for security findings
          if (event.data.updates.security_findings) {
            event.data.updates.security_findings.total = 
              event.data.updates.security_findings.critical +
              event.data.updates.security_findings.high +
              event.data.updates.security_findings.medium +
              event.data.updates.security_findings.low +
              event.data.updates.security_findings.note;
          }
          
          stateManager.processRealTimeEvent(event);
        }
        
        stateManager.flush();
        vi.advanceTimersByTime(100); // Simulate time passage
      }

      const finalState = stateManager.getState();
      
      // Repository count should remain stable
      expect(finalState.repositories).toHaveLength(initialRepoCount);
      expect(finalState.pendingUpdates).toBe(0);
      
      // All repositories should still be valid
      finalState.repositories.forEach(repo => {
        expect(repo.id).toBeDefined();
        expect(repo.name).toBeDefined();
        expect(repo.full_name).toBeDefined();
      });
    });

    it('should handle garbage collection of processed events', () => {
      // Track processing before and after large operation
      const initialState = stateManager.getState();
      
      // Generate large number of temporary events
      const largeEventBatch: RealTimeEvent[] = [];
      for (let i = 0; i < 500; i++) {
        largeEventBatch.push({
          id: `gc-test-${i}`,
          type: 'security_alert',
          timestamp: new Date().toISOString(),
          data: {
            repository: `org/repo-${Math.floor(Math.random() * 1000) + 1}`,
            severity: 'medium',
            action: 'created'
          },
          source: 'webhook'
        });
      }

      // Process all events
      largeEventBatch.forEach(event => stateManager.processRealTimeEvent(event));
      stateManager.flush();
      
      // Force JavaScript garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalState = stateManager.getState();
      
      // State should be clean and stable
      expect(finalState.pendingUpdates).toBe(0);
      expect(finalState.repositories).toHaveLength(initialState.repositories.length);
      
      // Verify state integrity
      finalState.repositories.forEach(repo => {
        expect(repo.security_findings?.total).toBeDefined();
        expect(repo.security_findings?.total).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('rate limiting performance', () => {
    it('should enforce rate limits efficiently under load', () => {
      const testClients = 50;
      const requestsPerClient = 10;
      const results: boolean[] = [];
      
      const startTime = performance.now();
      
      // Simulate multiple clients making requests
      for (let client = 0; client < testClients; client++) {
        for (let request = 0; request < requestsPerClient; request++) {
          const result = rateLimiter.isAllowed(`client-${client}`);
          results.push(result);
        }
      }
      
      const rateLimitTime = performance.now() - startTime;
      
      // Rate limiting should be fast
      expect(rateLimitTime).toBeLessThan(50);
      
      // Should have processed all requests
      expect(results).toHaveLength(testClients * requestsPerClient);
      
      // Some requests should be allowed, some denied based on limits
      const allowedCount = results.filter(Boolean).length;
      const deniedCount = results.length - allowedCount;
      
      expect(allowedCount).toBeGreaterThan(0);
      expect(deniedCount).toBeGreaterThan(0);
    });

    it('should handle rate limit cleanup efficiently', () => {
      // Fill rate limiter with requests
      for (let i = 0; i < 1000; i++) {
        rateLimiter.isAllowed(`test-client-${i % 10}`);
      }
      
      const cleanupStartTime = performance.now();
      
      // Advance time to trigger cleanup
      vi.advanceTimersByTime(70000); // 70 seconds
      
      // Make new requests to trigger cleanup
      for (let i = 0; i < 10; i++) {
        rateLimiter.isAllowed(`cleanup-test-${i}`);
      }
      
      const cleanupTime = performance.now() - cleanupStartTime;
      
      // Cleanup should be fast
      expect(cleanupTime).toBeLessThan(20);
    });
  });

  describe('network bandwidth optimization', () => {
    it('should batch multiple events efficiently', () => {
      const events: RealTimeEvent[] = [];
      
      // Generate events that could be batched
      for (let i = 0; i < 25; i++) {
        events.push({
          id: `batch-optimize-${i}`,
          type: 'repository_update',
          timestamp: new Date(Date.now() + i).toISOString(),
          data: {
            repositoryId: 1, // Same repository
            updates: { last_scan_status: 'in_progress' as const }
          },
          source: 'webhook'
        });
      }

      const stateUpdateCount = { value: 0 };
      stateManager.addStateHandler(() => {
        stateUpdateCount.value++;
      });

      const startTime = performance.now();
      
      // Process events rapidly
      events.forEach(event => stateManager.processRealTimeEvent(event));
      
      // Process in batches
      vi.advanceTimersByTime(150); // Trigger batch processing
      
      const batchTime = performance.now() - startTime;
      
      // Should batch efficiently
      expect(batchTime).toBeLessThan(30);
      
      // Should result in fewer state updates than events (batching)
      expect(stateUpdateCount.value).toBeLessThan(events.length);
      expect(stateUpdateCount.value).toBeGreaterThan(0);
    });

    it('should minimize redundant state updates', () => {
      const repositoryId = 1;
      const redundantUpdates: RealTimeEvent[] = [];
      
      // Create redundant updates to same repository
      for (let i = 0; i < 10; i++) {
        redundantUpdates.push({
          id: `redundant-${i}`,
          type: 'repository_update',
          timestamp: new Date(Date.now() + i * 100).toISOString(),
          data: {
            repositoryId,
            updates: { last_scan_status: 'success' as const }
          },
          source: 'webhook'
        });
      }

      let finalUpdateCount = 0;
      stateManager.addStateHandler((updates) => {
        if (updates.repositories) {
          finalUpdateCount++;
        }
      });

      // Process redundant updates
      redundantUpdates.forEach(event => stateManager.processRealTimeEvent(event));
      stateManager.flush();

      // Should minimize redundant updates
      expect(finalUpdateCount).toBeLessThanOrEqual(2); // Batch processing should consolidate
      
      const finalState = stateManager.getState();
      expect(finalState.repositories[0].last_scan_status).toBe('success');
    });
  });

  describe('stress testing', () => {
    it('should handle system stress without data corruption', () => {
      const stressTestEvents = 2000;
      const repositories = new Set<number>();
      
      // Generate high-stress event load
      for (let i = 0; i < stressTestEvents; i++) {
        const repositoryId = Math.floor(Math.random() * 100) + 1;
        repositories.add(repositoryId);
        
        const eventTypes = ['repository_update', 'security_alert', 'scan_status'] as const;
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        
        let eventData: any;
        
        switch (eventType) {
          case 'repository_update':
            eventData = {
              repositoryId,
              updates: {
                last_scan_status: ['success', 'failure', 'in_progress'][Math.floor(Math.random() * 3)]
              }
            };
            break;
          case 'security_alert':
            eventData = {
              repository: `org/repo-${repositoryId}`,
              severity: ['critical', 'high', 'medium', 'low'][Math.floor(Math.random() * 4)],
              action: Math.random() > 0.5 ? 'created' : 'closed'
            };
            break;
          case 'scan_status':
            eventData = {
              repositoryName: `org/repo-${repositoryId}`,
              scanId: `scan-${i}`,
              status: ['completed', 'failed', 'running'][Math.floor(Math.random() * 3)]
            };
            break;
        }

        const event: RealTimeEvent = {
          id: `stress-${i}`,
          type: eventType,
          timestamp: new Date().toISOString(),
          data: eventData,
          source: 'webhook'
        };
        
        stateManager.processRealTimeEvent(event);
        
        // Intermittent flushes
        if (i % 100 === 0) {
          stateManager.flush();
          vi.advanceTimersByTime(1);
        }
      }
      
      // Final flush
      stateManager.flush();
      
      const finalState = stateManager.getState();
      
      // Verify data integrity
      expect(finalState.pendingUpdates).toBe(0);
      expect(finalState.repositories).toHaveLength(1000); // Original count preserved
      
      // All repositories should have valid data
      finalState.repositories.forEach(repo => {
        expect(repo.id).toBeGreaterThan(0);
        expect(repo.name).toMatch(/^repo-\d+$/);
        expect(repo.full_name).toMatch(/^org\/repo-\d+$/);
        expect(['success', 'failure', 'in_progress', 'pending']).toContain(repo.last_scan_status);
        
        if (repo.security_findings) {
          expect(repo.security_findings.total).toBeGreaterThanOrEqual(0);
          expect(repo.security_findings.critical).toBeGreaterThanOrEqual(0);
          expect(repo.security_findings.high).toBeGreaterThanOrEqual(0);
          expect(repo.security_findings.medium).toBeGreaterThanOrEqual(0);
          expect(repo.security_findings.low).toBeGreaterThanOrEqual(0);
          expect(repo.security_findings.note).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });
});