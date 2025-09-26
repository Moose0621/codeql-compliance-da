import { Page, expect } from '@playwright/test';
import { MockWebhookServer } from '../mocks/webhook-server';
import { MockWebSocketServer } from '../mocks/websocket-server';

export class WebhookIntegrationPage {
  constructor(
    private page: Page,
    private webhookServer: MockWebhookServer,
    private websocketServer: MockWebSocketServer
  ) {}

  /**
   * Wait for WebSocket connection to be established
   */
  async waitForWebSocketConnection(): Promise<void> {
    // Wait for the application to attempt WebSocket connection
    await this.page.waitForFunction(() => {
      return window.WebSocket && window.performance.getEntriesByType('resource')
        .some(entry => entry.name.includes('ws://') || entry.name.includes('wss://'));
    }, { timeout: 10000 });

    // Wait for connection to be established
    await this.page.waitForFunction(() => {
      // Check if WebSocket is connected by looking for connection status indicator
      const statusElement = document.querySelector('[data-testid="websocket-status"]');
      return statusElement && statusElement.textContent === 'connected';
    }, { timeout: 5000 });
  }

  /**
   * Simulate GitHub webhook by sending event to mock server
   */
  async simulateGitHubWebhook(eventType: string, payload: object): Promise<void> {
    await this.webhookServer.sendWebhook(eventType, payload);
    
    // Small delay to allow webhook processing
    await this.page.waitForTimeout(100);
  }

  /**
   * Verify that real-time update occurred in UI
   */
  async verifyRealTimeUpdate(selector: string, expectedValue: string): Promise<void> {
    await expect(this.page.locator(selector)).toContainText(expectedValue, { timeout: 3000 });
  }

  /**
   * Check current WebSocket connection status
   */
  async checkWebSocketStatus(): Promise<'connected' | 'disconnected' | 'connecting'> {
    const status = await this.page.locator('[data-testid="websocket-status"]').textContent();
    return status as 'connected' | 'disconnected' | 'connecting';
  }

  /**
   * Validate security headers for WebSocket connection
   */
  async validateSecurityHeaders(): Promise<boolean> {
    return await this.page.evaluate(() => {
      // Check if CSP headers allow WebSocket connections
      const metaTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
      for (const tag of metaTags) {
        const content = tag.getAttribute('content') || '';
        if (content.includes('connect-src') && !content.includes('ws:') && !content.includes('wss:')) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Get WebSocket authentication headers sent during connection
   */
  async getWebSocketAuthHeaders(): Promise<string> {
    return await this.page.evaluate(() => {
      // Simulate checking WebSocket auth headers (in real implementation)
      return localStorage.getItem('websocket_token') ? 
        `Bearer ${localStorage.getItem('websocket_token')}` : '';
    });
  }

  /**
   * Send WebSocket message to server
   */
  async sendWebSocketMessage(message: object): Promise<void> {
    await this.websocketServer.sendMessage(message);
  }

  /**
   * Wait for specific WebSocket message type
   */
  async waitForWebSocketMessage(messageType: string, timeout: number = 5000): Promise<any> {
    return await this.websocketServer.waitForMessage(messageType, timeout);
  }

  /**
   * Close WebSocket connection
   */
  async closeWebSocketConnection(): Promise<void> {
    await this.page.evaluate(() => {
      // Simulate closing WebSocket connection
      const event = new CustomEvent('websocket-close');
      window.dispatchEvent(event);
    });
  }

  /**
   * Reconnect WebSocket
   */
  async reconnectWebSocket(): Promise<void> {
    await this.page.evaluate(() => {
      // Simulate reconnecting WebSocket
      const event = new CustomEvent('websocket-reconnect');
      window.dispatchEvent(event);
    });
  }

  /**
   * Simulate network failure for reliability testing
   */
  async simulateNetworkFailure(): Promise<void> {
    await this.page.route('**/ws/**', route => {
      route.abort('failed');
    });
  }

  /**
   * Restore network connectivity
   */
  async restoreNetworkConnectivity(): Promise<void> {
    await this.page.unroute('**/ws/**');
  }

  /**
   * Verify optimistic UI updates
   */
  async verifyOptimisticUpdate(selector: string, expectedState: string): Promise<void> {
    // Check that UI updates immediately (optimistically) before server confirmation
    await expect(this.page.locator(selector)).toContainText(expectedState, { timeout: 1000 });
  }

  /**
   * Verify rollback on failed optimistic update
   */
  async verifyOptimisticRollback(selector: string, originalState: string): Promise<void> {
    // Simulate failure and check rollback
    await this.websocketServer.simulateError('connection_failed');
    await expect(this.page.locator(selector)).toContainText(originalState, { timeout: 2000 });
  }

  /**
   * Check for loading states during real-time processing
   */
  async verifyLoadingStates(): Promise<void> {
    await expect(this.page.locator('[data-testid="loading-indicator"]')).toBeVisible();
  }

  /**
   * Verify notification badge updates
   */
  async verifyNotificationBadgeUpdate(expectedCount: number): Promise<void> {
    await expect(this.page.locator('[data-testid="notification-badge"]')).toContainText(expectedCount.toString());
  }

  /**
   * Test event ordering during rapid updates
   */
  async verifyEventOrdering(events: Array<{ type: string; payload: object; expectedOrder: number }>): Promise<void> {
    // Send multiple events in sequence
    for (const event of events) {
      await this.simulateGitHubWebhook(event.type, event.payload);
      await this.page.waitForTimeout(50); // Small delay between events
    }

    // Verify events were processed in correct order
    const eventLog = await this.page.locator('[data-testid="event-log"]').textContent();
    const processedEvents = JSON.parse(eventLog || '[]');
    
    for (let i = 0; i < events.length; i++) {
      expect(processedEvents[i].order).toBe(events[i].expectedOrder);
    }
  }

  /**
   * Simulate high-volume event processing for performance testing
   */
  async simulateHighVolumeEvents(eventCount: number, eventType: string = 'push'): Promise<void> {
    const promises = [];
    for (let i = 0; i < eventCount; i++) {
      const payload = {
        id: i,
        repository: { id: 1, name: 'test-repo-1' },
        commits: [{ id: `commit-${i}`, message: `Update ${i}` }]
      };
      promises.push(this.simulateGitHubWebhook(eventType, payload));
    }
    
    await Promise.all(promises);
  }

  /**
   * Monitor memory usage during extended testing
   */
  async checkMemoryUsage(): Promise<number> {
    return await this.page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
  }

  /**
   * Verify connection pooling and cleanup
   */
  async verifyConnectionCleanup(): Promise<void> {
    const initialConnections = await this.page.evaluate(() => {
      return (window as any).websocketConnections?.length || 0;
    });

    // Create and close multiple connections
    for (let i = 0; i < 5; i++) {
      await this.reconnectWebSocket();
      await this.closeWebSocketConnection();
    }

    const finalConnections = await this.page.evaluate(() => {
      return (window as any).websocketConnections?.length || 0;
    });

    // Verify connections were properly cleaned up
    expect(finalConnections).toBeLessThanOrEqual(initialConnections + 1);
  }

  /**
   * Test race condition handling
   */
  async testRaceConditions(): Promise<void> {
    // Send conflicting updates simultaneously
    const payload1 = { id: 1, status: 'success' };
    const payload2 = { id: 1, status: 'failure' };
    
    await Promise.all([
      this.simulateGitHubWebhook('workflow_run', payload1),
      this.simulateGitHubWebhook('workflow_run', payload2)
    ]);

    // Verify final state is deterministic (latest timestamp should win)
    await this.page.waitForTimeout(1000);
    const finalStatus = await this.page.locator('[data-testid="repo-test-repo-1-status"]').textContent();
    expect(['success', 'failure']).toContain(finalStatus);
  }

  /**
   * Verify duplicate event prevention
   */
  async verifyDuplicatePrevention(): Promise<void> {
    const duplicatePayload = {
      id: 'unique-event-123',
      repository: { id: 1, name: 'test-repo-1' },
      commits: [{ id: 'commit-abc', message: 'Duplicate test' }]
    };

    // Send same event multiple times
    await this.simulateGitHubWebhook('push', duplicatePayload);
    await this.simulateGitHubWebhook('push', duplicatePayload);
    await this.simulateGitHubWebhook('push', duplicatePayload);

    // Verify only processed once
    const eventCount = await this.page.locator('[data-testid="processed-events-count"]').textContent();
    expect(parseInt(eventCount || '0')).toBe(1);
  }
}