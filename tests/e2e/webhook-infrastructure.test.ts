import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockWebhookServer } from '../mocks/webhook-server.js';
import { MockWebSocketServer } from '../mocks/websocket-server.js';
import { WebhookTestDataManager } from '../test-data/webhook-payloads.js';

/**
 * Integration tests for webhook mock infrastructure
 * These tests validate our mock servers work correctly without requiring browser automation
 */
describe('Webhook Mock Infrastructure Tests', () => {
  let webhookServer: MockWebhookServer;
  let websocketServer: MockWebSocketServer;

  beforeAll(async () => {
    webhookServer = new MockWebhookServer(3001);
    websocketServer = new MockWebSocketServer(3002);
    
    await webhookServer.start();
    await websocketServer.start();
  });

  afterAll(async () => {
    await webhookServer.stop();
    await websocketServer.stop();
  });

  describe('MockWebhookServer', () => {
    it('should start and stop successfully', async () => {
      expect(webhookServer).toBeDefined();
      
      // Test server health
      const response = await fetch('http://localhost:3001/health');
      expect(response.status).toBe(200);
      
      const health = await response.json();
      expect(health.status).toBe('healthy');
    });

    it('should generate valid GitHub signatures', async () => {
      const payload = { test: 'data' };
      const payloadString = JSON.stringify(payload);
      
      const validSignature = webhookServer.generateGitHubSignature(payloadString);
      expect(validSignature).toMatch(/^sha256=[a-f0-9]+$/);
      
      const isValid = await webhookServer.testSignatureValidation(payload, true);
      expect(isValid).toBe(true);
      
      const isInvalid = await webhookServer.testSignatureValidation(payload, false);
      expect(isInvalid).toBe(false);
    });

    it('should handle webhook payload templates', () => {
      const templates = WebhookTestDataManager.getWebhookPayloadTemplates();
      
      expect(templates.push_main_branch).toBeDefined();
      expect(templates.pull_request_opened).toBeDefined();
      expect(templates.code_scanning_alert_created).toBeDefined();
      expect(templates.workflow_run_completed).toBeDefined();
      
      // Verify payload structure
      const pushPayload = templates.push_main_branch as any;
      expect(pushPayload.repository).toBeDefined();
      expect(pushPayload.repository.id).toBe(1);
      expect(pushPayload.commits).toBeInstanceOf(Array);
    });

    it('should detect malicious payloads', () => {
      const maliciousPayloads = WebhookTestDataManager.getMaliciousPayloads();
      
      expect(maliciousPayloads.sql_injection).toBeDefined();
      expect(maliciousPayloads.xss_script).toBeDefined();
      
      // Verify XSS payload contains dangerous content
      const xssPayload = maliciousPayloads.xss_script as any;
      expect(xssPayload.issue.title).toContain('<script>');
    });

    it('should simulate rate limiting behavior', async () => {
      const startTime = Date.now();
      
      try {
        await webhookServer.simulateRateLimit(10, 50); // 10 events in 500ms
      } catch (error) {
        // Rate limiting may throw error
        expect(error).toBeDefined();
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThan(400); // Should take some time
    });

    it('should handle large payload generation', () => {
      const largePayload = WebhookTestDataManager.generateLargePayload(100); // 100KB
      
      expect(largePayload).toBeDefined();
      expect(largePayload).toHaveProperty('large_field');
      
      const payloadString = JSON.stringify(largePayload);
      expect(payloadString.length).toBeGreaterThan(100000); // Should be large
    });
  });

  describe('MockWebSocketServer', () => {
    it('should start and accept connections', async () => {
      expect(websocketServer).toBeDefined();
      
      // Test server is running
      const clientCount = websocketServer.getConnectedClientsCount();
      expect(clientCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle message sending and queuing', async () => {
      const testMessage = {
        type: 'test',
        payload: { test: 'data' }
      };

      await websocketServer.sendMessage(testMessage);
      
      const messages = websocketServer.getMessages();
      expect(messages.length).toBeGreaterThan(0);
      
      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.type).toBe('test');
      expect(lastMessage.payload).toEqual(testMessage);
    });

    it('should simulate connection failures', async () => {
      const initialCount = websocketServer.getConnectedClientsCount();
      
      await websocketServer.simulateConnectionFailure();
      
      const finalCount = websocketServer.getConnectedClientsCount();
      expect(finalCount).toBeLessThanOrEqual(initialCount);
    });

    it('should test high-frequency message handling', async () => {
      const messagesPerSecond = 10;
      const testDuration = 1; // 1 second
      
      const initialMessageCount = websocketServer.getMessages().length;
      
      await websocketServer.testHighFrequencyMessages(messagesPerSecond, testDuration);
      
      // Wait a bit for messages to be processed
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const finalMessageCount = websocketServer.getMessages().length;
      expect(finalMessageCount - initialMessageCount).toBeGreaterThanOrEqual(messagesPerSecond * testDuration);
    });

    it('should validate connection limits', async () => {
      const maxConnections = 5;
      const canConnect = await websocketServer.testConnectionLimit(maxConnections);
      
      // Should return boolean indicating if connection is allowed
      expect(typeof canConnect).toBe('boolean');
    });

    it('should handle message ordering in concurrent scenarios', async () => {
      const messageCount = 5;
      
      await websocketServer.testConcurrentMessages(messageCount);
      
      const messages = websocketServer.getMessages();
      const recentMessages = messages.slice(-messageCount);
      
      expect(recentMessages.length).toBe(messageCount);
      
      // Verify all messages have concurrent_test type
      recentMessages.forEach(message => {
        expect(message.type).toBe('concurrent_test');
        expect(message.payload).toBeDefined();
      });
    });
  });

  describe('Test Data Management', () => {
    it('should provide comprehensive webhook payload templates', () => {
      const templates = WebhookTestDataManager.getWebhookPayloadTemplates();
      
      const expectedEvents = [
        'push_main_branch',
        'pull_request_opened', 
        'code_scanning_alert_created',
        'workflow_run_completed',
        'repository_archived',
        'issues_opened'
      ];

      expectedEvents.forEach(eventType => {
        expect(templates[eventType]).toBeDefined();
        expect(typeof templates[eventType]).toBe('object');
      });
    });

    it('should generate repository test data', () => {
      const repoCount = 10;
      const repos = WebhookTestDataManager.generateRepositoryTestData(repoCount);
      
      expect(repos).toHaveLength(repoCount);
      
      repos.forEach((repo, index) => {
        expect(repo.id).toBe(index + 1);
        expect(repo.name).toBe(`test-repo-${index + 1}`);
        expect(repo.full_name).toBe(`test-org/test-repo-${index + 1}`);
        expect(repo.owner.login).toBe('test-org');
      });
    });

    it('should provide security test payloads with dangerous content', () => {
      const maliciousPayloads = WebhookTestDataManager.getMaliciousPayloads();
      
      // SQL Injection payload
      const sqlPayload = maliciousPayloads.sql_injection as any;
      expect(sqlPayload.issue.title).toContain('DROP TABLE');
      expect(sqlPayload.issue.body).toContain('SELECT');
      
      // XSS payload
      const xssPayload = maliciousPayloads.xss_script as any;
      expect(xssPayload.issue.title).toContain('<script>');
      expect(xssPayload.issue.body).toContain('onerror=');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle webhook event simulation under load', async () => {
      const eventCount = 50;
      const promises = [];
      
      for (let i = 0; i < eventCount; i++) {
        const promise = webhookServer.sendWebhook('push', {
          id: `load-test-${i}`,
          repository: { id: 1, name: 'test-repo' },
          commits: [{ id: `commit-${i}`, message: `Load test ${i}` }]
        });
        promises.push(promise);
      }
      
      const startTime = Date.now();
      await Promise.all(promises);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      const events = webhookServer.getEvents();
      expect(events.length).toBeGreaterThanOrEqual(eventCount);
    });

    it('should maintain performance with large payloads', async () => {
      const largePayload = WebhookTestDataManager.generateLargePayload(500); // 500KB
      
      const startTime = Date.now();
      await webhookServer.sendWebhook('push', largePayload);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(5000); // Should handle large payloads efficiently
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty payloads gracefully', async () => {
      await expect(webhookServer.sendWebhook('push', {})).resolves.not.toThrow();
      
      const events = webhookServer.getEvents();
      const lastEvent = events[events.length - 1];
      expect(lastEvent.payload).toEqual({});
    });

    it('should simulate delivery failures', async () => {
      await expect(
        webhookServer.simulateDeliveryFailure('push', { test: 'data' })
      ).rejects.toThrow('Webhook delivery failed');
    });

    it('should handle WebSocket errors gracefully', async () => {
      const errorType = 'test_error';
      
      await expect(
        websocketServer.simulateError(errorType)
      ).resolves.not.toThrow();
      
      const messages = websocketServer.getMessages();
      const errorMessage = messages.find(msg => msg.type === 'error');
      expect(errorMessage).toBeDefined();
      expect(errorMessage?.payload?.error_type).toBe(errorType);
    });
  });
});