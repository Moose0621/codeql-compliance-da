import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebhookService } from '@/lib/webhook-service';
import type { GitHubWorkflowEvent } from '@/types/dashboard';

// Mock crypto.subtle for testing
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      importKey: vi.fn(),
      sign: vi.fn(),
    },
  },
  writable: true,
});

// Mock EventSource
Object.defineProperty(global, 'EventSource', {
  value: vi.fn().mockImplementation((url, options) => ({
    url,
    readyState: 1,
    onopen: null,
    onmessage: null,
    onerror: null,
    close: vi.fn(),
    addEventListener: vi.fn(),
  })),
  writable: true,
});

const mockWorkflowEvent: GitHubWorkflowEvent = {
  action: 'completed',
  workflow_run: {
    id: 123456,
    name: 'CodeQL Analysis',
    html_url: 'https://github.com/test-org/test-repo/actions/runs/123456',
    status: 'completed',
    conclusion: 'success',
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:05:00Z',
    repository: {
      id: 1,
      name: 'test-repo',
      full_name: 'test-org/test-repo',
    },
    head_branch: 'main',
    head_sha: 'abc123',
    path: '.github/workflows/codeql.yml',
    run_number: 42,
    event: 'push',
  },
  repository: {
    id: 1,
    name: 'test-repo',
    full_name: 'test-org/test-repo',
    owner: {
      login: 'test-org',
      avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
    },
    default_branch: 'main',
  },
  organization: {
    login: 'test-org',
  },
};

describe('WebhookService', () => {
  let webhookService: WebhookService;

  beforeEach(() => {
    webhookService = new WebhookService('/test/webhook');
    vi.clearAllMocks();
  });

  afterEach(() => {
    webhookService.disconnect();
  });

  describe('signature verification', () => {
    test('should verify valid GitHub webhook signature', async () => {
      const payload = '{"test": "data"}';
      const secret = 'test-secret';
      
      // Mock crypto functions
      const mockArrayBuffer = new ArrayBuffer(32);
      const mockUint8Array = new Uint8Array(mockArrayBuffer);
      mockUint8Array.fill(171); // Mock signature bytes
      
      vi.mocked(crypto.subtle.importKey).mockResolvedValue({} as any);
      vi.mocked(crypto.subtle.sign).mockResolvedValue(mockArrayBuffer);
      
      const signature = 'sha256=' + Array.from(mockUint8Array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const result = await WebhookService.verifySignature(payload, signature, secret);
      expect(result).toBe(true);
    });

    test('should reject invalid signature format', async () => {
      const result = await WebhookService.verifySignature('{}', 'invalid', 'secret');
      expect(result).toBe(false);
    });

    test('should handle signature verification errors', async () => {
      vi.mocked(crypto.subtle.importKey).mockRejectedValue(new Error('Crypto error'));
      
      const result = await WebhookService.verifySignature('{}', 'sha256=abc123', 'secret');
      expect(result).toBe(false);
    });
  });

  describe('workflow event handling', () => {
    test('should process CodeQL workflow completion event', async () => {
      const updates: any[] = [];
      webhookService.subscribe('all', (update) => updates.push(update));

      await webhookService.handleWorkflowEvent(mockWorkflowEvent);

      expect(updates).toHaveLength(2); // repository_status and notification
      
      const statusUpdate = updates.find(u => u.type === 'repository_status');
      expect(statusUpdate).toEqual({
        type: 'repository_status',
        timestamp: expect.any(String),
        data: {
          repositoryId: 1,
          status: 'success',
        },
      });

      const notificationUpdate = updates.find(u => u.type === 'notification');
      expect(notificationUpdate.data.notification.type).toBe('scan_completed');
      expect(notificationUpdate.data.notification.title).toBe('CodeQL Scan Completed');
    });

    test('should ignore non-CodeQL workflows', async () => {
      const nonCodeQLEvent = {
        ...mockWorkflowEvent,
        workflow_run: {
          ...mockWorkflowEvent.workflow_run,
          name: 'CI Tests',
          path: '.github/workflows/ci.yml',
        },
      };

      const updates: any[] = [];
      webhookService.subscribe('all', (update) => updates.push(update));

      await webhookService.handleWorkflowEvent(nonCodeQLEvent);

      expect(updates).toHaveLength(0);
    });

    test('should handle workflow failure', async () => {
      const failedEvent = {
        ...mockWorkflowEvent,
        workflow_run: {
          ...mockWorkflowEvent.workflow_run,
          conclusion: 'failure' as const,
        },
      };

      const updates: any[] = [];
      webhookService.subscribe('all', (update) => updates.push(update));

      await webhookService.handleWorkflowEvent(failedEvent);

      const statusUpdate = updates.find(u => u.type === 'repository_status');
      expect(statusUpdate.data.status).toBe('failure');

      const notificationUpdate = updates.find(u => u.type === 'notification');
      expect(notificationUpdate.data.notification.type).toBe('scan_failed');
      expect(notificationUpdate.data.notification.severity).toBe('error');
    });
  });

  describe('EventSource connection', () => {
    test('should connect to SSE endpoint', () => {
      webhookService.connect();
      
      expect(EventSource).toHaveBeenCalledWith('/test/webhook', {
        withCredentials: true,
      });
    });

    test('should handle connection status changes', () => {
      const statusChanges: string[] = [];
      webhookService.onConnectionStatusChange((status) => statusChanges.push(status));

      expect(statusChanges).toContain('disconnected'); // Initial status

      webhookService.connect();
      
      // Simulate EventSource open event
      const mockEventSource = vi.mocked(EventSource).mock.results[0].value;
      mockEventSource.onopen?.({} as any);
      
      expect(statusChanges).toContain('connected');
    });

    test('should disconnect and cleanup', () => {
      webhookService.connect();
      const mockEventSource = vi.mocked(EventSource).mock.results[0].value;

      webhookService.disconnect();
      
      expect(mockEventSource.close).toHaveBeenCalled();
      expect(webhookService.getConnectionStatus()).toBe('disconnected');
    });
  });

  describe('subscription management', () => {
    test('should subscribe to update types', () => {
      const updates: any[] = [];
      const unsubscribe = webhookService.subscribe('repository_status', (update) => {
        updates.push(update);
      });

      // Emit an update
      webhookService['emitUpdate']({
        type: 'repository_status',
        timestamp: new Date().toISOString(),
        data: { repositoryId: 1, status: 'success' },
      });

      expect(updates).toHaveLength(1);

      // Test unsubscribe
      unsubscribe();
      webhookService['emitUpdate']({
        type: 'repository_status',
        timestamp: new Date().toISOString(),
        data: { repositoryId: 2, status: 'failure' },
      });

      expect(updates).toHaveLength(1); // Should not receive the second update
    });

    test('should handle subscription errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });

      webhookService.subscribe('notification', errorCallback);

      // Should not throw
      expect(() => {
        webhookService['emitUpdate']({
          type: 'notification',
          timestamp: new Date().toISOString(),
          data: {},
        });
      }).not.toThrow();

      expect(errorCallback).toHaveBeenCalled();
    });
  });

  describe('reconnection logic', () => {
    test('should schedule reconnection on error', () => {
      vi.useFakeTimers();
      
      webhookService.connect();
      const mockEventSource = vi.mocked(EventSource).mock.results[0].value;
      
      // Simulate error
      mockEventSource.onerror?.({} as any);
      expect(webhookService.getConnectionStatus()).toBe('disconnected');
      
      // Fast forward time to trigger reconnection
      vi.advanceTimersByTime(2000);
      
      // Should attempt to reconnect
      expect(EventSource).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });

    test('should stop reconnecting after max attempts', () => {
      vi.useFakeTimers();
      
      webhookService.connect();
      
      // Simulate multiple failures
      for (let i = 0; i < 6; i++) {
        const mockEventSource = vi.mocked(EventSource).mock.results[i].value;
        mockEventSource.onerror?.({} as any);
        vi.advanceTimersByTime(60000); // Advance by max delay
      }
      
      // Should not exceed max attempts (5)
      expect(EventSource).toHaveBeenCalledTimes(6); // Initial + 5 retries
      
      vi.useRealTimers();
    });
  });
});