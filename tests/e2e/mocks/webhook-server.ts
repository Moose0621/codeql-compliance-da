import { createHash, createHmac } from 'crypto';
import * as http from 'http';

export interface WebhookEvent {
  eventType: string;
  payload: object;
  timestamp: number;
  signature?: string;
}

export class MockWebhookServer {
  private server: http.Server | null = null;
  private port: number = 3001;
  private secret: string = 'test-webhook-secret-123';
  private events: WebhookEvent[] = [];
  private webhookEndpoint: string = '/webhook';

  constructor(port: number = 3001) {
    this.port = port;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.port, () => {
        console.log(`Mock webhook server started on port ${this.port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Mock webhook server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Send webhook event (simulates GitHub sending webhook to our application)
   */
  async sendWebhook(eventType: string, payload: object): Promise<void> {
    const timestamp = Date.now();
    const bodyData = JSON.stringify(payload);
    
    // Generate GitHub-style signature
    const signature = this.generateGitHubSignature(bodyData);
    
    const event: WebhookEvent = {
      eventType,
      payload,
      timestamp,
      signature
    };

    this.events.push(event);

    // Simulate sending to actual webhook endpoint
    // In real implementation, this would POST to the application's webhook endpoint
    await this.simulateWebhookDelivery(event);
  }

  /**
   * Generate GitHub-style webhook signature for security testing
   */
  generateGitHubSignature(payload: string): string {
    const hmac = createHmac('sha256', this.secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Generate invalid signature for security testing
   */
  generateInvalidSignature(payload: string): string {
    return `sha256=${createHash('sha256').update(payload + 'invalid').digest('hex')}`;
  }

  /**
   * Simulate webhook replay attack
   */
  async simulateReplayAttack(originalEvent: WebhookEvent): Promise<void> {
    // Send the same event with original timestamp (should be rejected)
    await this.simulateWebhookDelivery(originalEvent);
  }

  /**
   * Simulate payload tampering attack
   */
  async simulateTamperedPayload(eventType: string, originalPayload: object, signature: string): Promise<void> {
    const tamperedPayload = {
      ...originalPayload,
      malicious: 'injected data'
    };

    const event: WebhookEvent = {
      eventType,
      payload: tamperedPayload,
      timestamp: Date.now(),
      signature // Original signature won't match tampered payload
    };

    await this.simulateWebhookDelivery(event);
  }

  /**
   * Simulate rate limit testing by sending multiple webhooks rapidly
   */
  async simulateRateLimit(eventCount: number, intervalMs: number = 10): Promise<void> {
    const promises = [];
    
    for (let i = 0; i < eventCount; i++) {
      promises.push(
        new Promise<void>(resolve => {
          setTimeout(async () => {
            await this.sendWebhook('push', {
              id: `rate-limit-test-${i}`,
              repository: { id: 1, name: 'test-repo' }
            });
            resolve();
          }, i * intervalMs);
        })
      );
    }
    
    await Promise.all(promises);
  }

  /**
   * Get received webhook events for verification
   */
  getEvents(): WebhookEvent[] {
    return [...this.events];
  }

  /**
   * Clear event history
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Get webhook payload templates for different GitHub event types
   */
  getPayloadTemplate(eventType: string): object {
    const templates = {
      push: {
        ref: 'refs/heads/main',
        before: '0000000000000000000000000000000000000000',
        after: 'abc123def456789',
        repository: {
          id: 1,
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          owner: { login: 'test-org' }
        },
        commits: [{
          id: 'abc123def456789',
          message: 'Test commit',
          timestamp: new Date().toISOString(),
          author: { name: 'Test User', email: 'test@example.com' }
        }]
      },
      
      pull_request: {
        action: 'opened',
        number: 123,
        pull_request: {
          id: 456,
          number: 123,
          state: 'open',
          title: 'Test PR',
          body: 'Test pull request',
          base: { ref: 'main' },
          head: { ref: 'feature-branch' },
          user: { login: 'test-user' }
        },
        repository: {
          id: 1,
          name: 'test-repo',
          full_name: 'test-org/test-repo'
        }
      },

      code_scanning_alert: {
        action: 'created',
        alert: {
          number: 789,
          state: 'open',
          rule: {
            id: 'js/sql-injection',
            severity: 'error',
            security_severity_level: 'high',
            description: 'SQL injection vulnerability'
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        repository: {
          id: 1,
          name: 'test-repo',
          full_name: 'test-org/test-repo'
        }
      },

      workflow_run: {
        action: 'completed',
        workflow_run: {
          id: 12345,
          name: 'CodeQL',
          status: 'completed',
          conclusion: 'success',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          workflow_id: 678
        },
        repository: {
          id: 1,
          name: 'test-repo',
          full_name: 'test-org/test-repo'
        }
      },

      repository: {
        action: 'archived',
        repository: {
          id: 1,
          name: 'test-repo',
          full_name: 'test-org/test-repo',
          archived: true,
          owner: { login: 'test-org' }
        }
      },

      issues: {
        action: 'opened',
        issue: {
          number: 456,
          title: 'Test issue',
          body: 'Test issue body',
          state: 'open',
          user: { login: 'test-user' }
        },
        repository: {
          id: 1,
          name: 'test-repo',
          full_name: 'test-org/test-repo'
        }
      }
    };

    return templates[eventType as keyof typeof templates] || {};
  }

  /**
   * Generate large payload for performance testing
   */
  generateLargePayload(sizeKB: number): object {
    const basePayload = this.getPayloadTemplate('push');
    const largeData = 'x'.repeat(sizeKB * 1024);
    
    return {
      ...basePayload,
      large_data: largeData
    };
  }

  /**
   * Generate malformed payload for error testing
   */
  generateMalformedPayload(): string {
    return '{"invalid": json syntax,}';
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.setHeader('Content-Type', 'application/json');

    if (req.url === '/health') {
      res.statusCode = 200;
      res.end(JSON.stringify({ status: 'healthy', events: this.events.length }));
      return;
    }

    if (req.url === '/events') {
      res.statusCode = 200;
      res.end(JSON.stringify(this.events));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  private async simulateWebhookDelivery(event: WebhookEvent): Promise<void> {
    // In real implementation, this would POST to the application's webhook endpoint
    // For testing purposes, we simulate the delivery and processing
    console.log(`Simulating webhook delivery: ${event.eventType} at ${new Date(event.timestamp).toISOString()}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  /**
   * Simulate network failures during webhook delivery
   */
  async simulateDeliveryFailure(eventType: string, payload: object): Promise<void> {
    const event: WebhookEvent = {
      eventType,
      payload,
      timestamp: Date.now()
    };

    // Simulate delivery failure
    throw new Error(`Webhook delivery failed for ${eventType}`);
  }

  /**
   * Test webhook validation logic
   */
  async testSignatureValidation(payload: object, validSignature: boolean = true): Promise<boolean> {
    const bodyData = JSON.stringify(payload);
    const signature = validSignature ? 
      this.generateGitHubSignature(bodyData) : 
      this.generateInvalidSignature(bodyData);

    // Simulate signature validation logic that would be in the real application
    const expectedSignature = this.generateGitHubSignature(bodyData);
    return signature === expectedSignature;
  }
}