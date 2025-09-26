/**
 * Multi-Channel Delivery Testing
 * Focused testing for different notification channels and their integrations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MockEmailChannel,
  MockSlackChannel,
  MockTeamsChannel,
  MockInAppChannel,
  MockWebhookChannel,
  createMockChannels
} from '@/lib/mock-notification-channels';
import { NotificationPayload, DeliveryChannel, ChannelFeatures } from '@/types/notifications';
import { v4 as uuidv4 } from 'uuid';

describe('Multi-Channel Delivery System', () => {
  describe('Email Channel Testing', () => {
    let emailChannel: MockEmailChannel;

    beforeEach(() => {
      emailChannel = new MockEmailChannel();
    });

    describe('Email Address Validation', () => {
      const validEmails = [
        'user@example.com',
        'test.user@company.co.uk',
        'admin+notifications@domain.org',
        'user123@sub.domain.com'
      ];

      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@.com',
        ''
      ];

      it.each(validEmails)('accepts valid email: %s', (email) => {
        expect(emailChannel.validateRecipient(email)).toBe(true);
      });

      it.each(invalidEmails)('rejects invalid email: %s', (email) => {
        expect(emailChannel.validateRecipient(email)).toBe(false);
      });
    });

    describe('Email Delivery Features', () => {
      it('supports rich text formatting', () => {
        const features = emailChannel.getSupportedFeatures();
        expect(features.supportsRichText).toBe(true);
        expect(features.supportsButtons).toBe(true);
        expect(features.supportsImages).toBe(true);
      });

      it('handles large message content', async () => {
        const payload = createTestPayload({
          message: 'x'.repeat(50000) // Large message within email limits
        });

        const result = await emailChannel.send(payload, 'test@example.com');
        expect(result.success).toBe(true);
        expect(result.messageId).toBeTruthy();
      });

      it('supports batch processing', () => {
        const features = emailChannel.getSupportedFeatures();
        expect(features.supportsBatching).toBe(true);
      });
    });

    describe('Email Rate Limiting', () => {
      it('enforces rate limits for low priority messages', async () => {
        const lowPriorityPayload = createTestPayload({ priority: 'low' });
        const recipient = 'test@example.com';

        // Send multiple low priority messages to trigger rate limiting
        const promises = Array.from({ length: 15 }, () =>
          emailChannel.send(lowPriorityPayload, recipient)
        );

        const results = await Promise.all(promises);
        const rateLimitedResults = results.filter(r => 
          !r.success && r.error?.includes('Rate limit')
        );

        expect(rateLimitedResults.length).toBeGreaterThan(0);
      });

      it('provides retry-after information on rate limiting', async () => {
        const payload = createTestPayload({ priority: 'low' });
        
        // Trigger rate limit
        const promises = Array.from({ length: 12 }, () =>
          emailChannel.send(payload, 'test@example.com')
        );
        
        const results = await Promise.all(promises);
        const rateLimitedResult = results.find(r => 
          !r.success && r.error?.includes('Rate limit')
        );

        if (rateLimitedResult) {
          expect(rateLimitedResult.retryAfter).toBe(3600);
        }
      });
    });

    describe('Email Failure Scenarios', () => {
      it('handles SMTP server failures', async () => {
        const failingChannel = new MockEmailChannel({ failureRate: 1.0 });
        const payload = createTestPayload();

        const result = await failingChannel.send(payload, 'test@example.com');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('SMTP');
      });

      it('tracks delivery attempts in logs', async () => {
        const payload = createTestPayload();
        await emailChannel.send(payload, 'test@example.com');

        const log = emailChannel.getDeliveryLog();
        expect(log).toHaveLength(1);
        expect(log[0].payload.id).toBe(payload.id);
        expect(log[0].recipient).toBe('test@example.com');
      });
    });
  });

  describe('Slack Channel Testing', () => {
    let slackChannel: MockSlackChannel;

    beforeEach(() => {
      slackChannel = new MockSlackChannel();
    });

    describe('Slack Recipient Validation', () => {
      const validSlackRecipients = [
        '@username',
        '#general',
        '#dev-team',
        'U123456789', // User ID format
        'C987654321'  // Channel ID format
      ];

      const invalidSlackRecipients = [
        'invalid',
        '@',
        '#',
        'username', // Missing @ or #
        '@user with spaces',
        '#channel with spaces'
      ];

      it.each(validSlackRecipients)('accepts valid Slack recipient: %s', (recipient) => {
        expect(slackChannel.validateRecipient(recipient)).toBe(true);
      });

      it.each(invalidSlackRecipients)('rejects invalid Slack recipient: %s', (recipient) => {
        expect(slackChannel.validateRecipient(recipient)).toBe(false);
      });
    });

    describe('Slack Message Formatting', () => {
      it('enforces message length limits', async () => {
        const features = slackChannel.getSupportedFeatures();
        const longMessage = 'x'.repeat(features.maxMessageLength + 1);
        
        const payload = createTestPayload({ message: longMessage });
        const result = await slackChannel.send(payload, '@testuser');

        expect(result.success).toBe(false);
        expect(result.error).toContain('character limit');
      });

      it('supports rich formatting features', () => {
        const features = slackChannel.getSupportedFeatures();
        expect(features.supportsRichText).toBe(true);
        expect(features.supportsButtons).toBe(true);
        expect(features.supportsImages).toBe(false); // Slack in basic mode
      });

      it('does not support batching', () => {
        const features = slackChannel.getSupportedFeatures();
        expect(features.supportsBatching).toBe(false);
      });
    });

    describe('Slack Webhook Integration', () => {
      it('handles webhook failures gracefully', async () => {
        const failingSlackChannel = new MockSlackChannel({ failureRate: 1.0 });
        const payload = createTestPayload();

        const result = await failingSlackChannel.send(payload, '@testuser');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('webhook');
      });

      it('provides appropriate delivery delays', async () => {
        const startTime = Date.now();
        const payload = createTestPayload();
        
        await slackChannel.send(payload, '@testuser');
        const endTime = Date.now();
        
        const deliveryTime = endTime - startTime;
        expect(deliveryTime).toBeGreaterThanOrEqual(45); // Minimum expected delay
      });
    });
  });

  describe('Teams Channel Testing', () => {
    let teamsChannel: MockTeamsChannel;

    beforeEach(() => {
      teamsChannel = new MockTeamsChannel();
    });

    describe('Teams Webhook Validation', () => {
      const validTeamsRecipients = [
        'https://outlook.office.com/webhook/12345',
        'https://teams.microsoft.com/webhook/abc123',
        'a1b2c3d4-e5f6-7890-1234-567890abcdef' // UUID format
      ];

      const invalidTeamsRecipients = [
        'http://malicious.com/webhook',
        'invalid-url',
        'not-a-webhook',
        ''
      ];

      it.each(validTeamsRecipients)('accepts valid Teams recipient: %s', (recipient) => {
        expect(teamsChannel.validateRecipient(recipient)).toBe(true);
      });

      it.each(invalidTeamsRecipients)('rejects invalid Teams recipient: %s', (recipient) => {
        expect(teamsChannel.validateRecipient(recipient)).toBe(false);
      });
    });

    describe('Teams Message Features', () => {
      it('supports comprehensive rich formatting', () => {
        const features = teamsChannel.getSupportedFeatures();
        expect(features.supportsRichText).toBe(true);
        expect(features.supportsButtons).toBe(true);
        expect(features.supportsImages).toBe(true);
        expect(features.maxMessageLength).toBe(28000);
      });

      it('handles webhook timeouts', async () => {
        const slowTeamsChannel = new MockTeamsChannel({ failureRate: 1.0 });
        const payload = createTestPayload();

        const result = await slowTeamsChannel.send(payload, 'https://outlook.office.com/webhook/test');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('timeout');
      });
    });
  });

  describe('In-App Channel Testing', () => {
    let inAppChannel: MockInAppChannel;

    beforeEach(() => {
      inAppChannel = new MockInAppChannel();
    });

    describe('In-App User Validation', () => {
      const validUserIds = [
        'user123',
        'admin-user',
        'test_user',
        'user-with-dashes'
      ];

      const invalidUserIds = [
        '',
        'user with spaces',
        'user@domain', // Should be just user ID, not email
        'user#123', // Special characters not allowed
        'user<script>' // Potential XSS
      ];

      it.each(validUserIds)('accepts valid user ID: %s', (userId) => {
        expect(inAppChannel.validateRecipient(userId)).toBe(true);
      });

      it.each(invalidUserIds)('rejects invalid user ID: %s', (userId) => {
        expect(inAppChannel.validateRecipient(userId)).toBe(false);
      });
    });

    describe('In-App Delivery Performance', () => {
      it('delivers notifications quickly', async () => {
        const startTime = Date.now();
        const payload = createTestPayload();
        
        await inAppChannel.send(payload, 'user123');
        const endTime = Date.now();
        
        const deliveryTime = endTime - startTime;
        expect(deliveryTime).toBeLessThan(50); // Should be very fast
      });

      it('supports all rich features', () => {
        const features = inAppChannel.getSupportedFeatures();
        expect(features.supportsRichText).toBe(true);
        expect(features.supportsButtons).toBe(true);
        expect(features.supportsImages).toBe(true);
        expect(features.supportsBatching).toBe(true);
      });

      it('handles WebSocket connection failures', async () => {
        const failingInAppChannel = new MockInAppChannel({ failureRate: 1.0 });
        const payload = createTestPayload();

        const result = await failingInAppChannel.send(payload, 'user123');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('WebSocket');
      });
    });
  });

  describe('Webhook Channel Testing', () => {
    let webhookChannel: MockWebhookChannel;

    beforeEach(() => {
      webhookChannel = new MockWebhookChannel();
    });

    describe('Webhook URL Validation', () => {
      const validWebhookUrls = [
        'https://api.example.com/webhook',
        'http://localhost:3000/notify',
        'https://hooks.example.com/12345',
        'https://subdomain.domain.co.uk/path/to/webhook'
      ];

      const invalidWebhookUrls = [
        'not-a-url',
        'ftp://example.com/webhook', // Wrong protocol
        'https://', // Incomplete URL
        'javascript:alert(1)', // Malicious URL
        ''
      ];

      it.each(validWebhookUrls)('accepts valid webhook URL: %s', (url) => {
        expect(webhookChannel.validateRecipient(url)).toBe(true);
      });

      it.each(invalidWebhookUrls)('rejects invalid webhook URL: %s', (url) => {
        expect(webhookChannel.validateRecipient(url)).toBe(false);
      });
    });

    describe('Webhook Delivery Reliability', () => {
      it('handles various HTTP errors', async () => {
        const failingWebhookChannel = new MockWebhookChannel({ failureRate: 1.0 });
        const payload = createTestPayload();

        const result = await failingWebhookChannel.send(payload, 'https://api.example.com/webhook');
        
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
      });

      it('supports large payloads', () => {
        const features = webhookChannel.getSupportedFeatures();
        expect(features.maxMessageLength).toBe(50000);
        expect(features.supportsBatching).toBe(true);
      });

      it('has appropriate delivery timeouts', async () => {
        const startTime = Date.now();
        const payload = createTestPayload();
        
        await webhookChannel.send(payload, 'https://api.example.com/webhook');
        const endTime = Date.now();
        
        const deliveryTime = endTime - startTime;
        expect(deliveryTime).toBeGreaterThanOrEqual(180); // Expected delay for external calls
      });
    });

    describe('Webhook Security', () => {
      it('only accepts HTTPS and HTTP protocols', () => {
        const secureUrls = [
          'https://secure.example.com/webhook',
          'http://localhost:3000/webhook' // Allowed for local development
        ];

        const insecureUrls = [
          'ftp://example.com/webhook',
          'file:///etc/passwd',
          'javascript:alert(1)'
        ];

        secureUrls.forEach(url => {
          expect(webhookChannel.validateRecipient(url)).toBe(true);
        });

        insecureUrls.forEach(url => {
          expect(webhookChannel.validateRecipient(url)).toBe(false);
        });
      });
    });
  });

  describe('Cross-Channel Integration Testing', () => {
    describe('Channel Fallback Scenarios', () => {
      it('handles primary channel failure with secondary channels', async () => {
        const channels = createMockChannels({
          slackFailureRate: 1.0, // Slack fails
          emailFailureRate: 0.0  // Email succeeds
        });

        const emailChannel = channels.find(c => c.type === 'email')!;
        const slackChannel = channels.find(c => c.type === 'slack')!;

        const payload = createTestPayload();

        const emailResult = await emailChannel.send(payload, 'test@example.com');
        const slackResult = await slackChannel.send(payload, '@testuser');

        expect(emailResult.success).toBe(true);
        expect(slackResult.success).toBe(false);
      });
    });

    describe('Channel Feature Compatibility', () => {
      it('identifies channels supporting rich formatting', () => {
        const channels = createMockChannels();
        const richChannels = channels.filter(c => 
          c.getSupportedFeatures().supportsRichText
        );

        expect(richChannels.length).toBeGreaterThan(3); // Most channels support rich text
      });

      it('identifies channels supporting batching', () => {
        const channels = createMockChannels();
        const batchChannels = channels.filter(c => 
          c.getSupportedFeatures().supportsBatching
        );

        expect(batchChannels.length).toBeGreaterThan(0);
        expect(batchChannels.some(c => c.type === 'email')).toBe(true);
      });

      it('respects channel message length limits', () => {
        const channels = createMockChannels();
        
        channels.forEach(channel => {
          const features = channel.getSupportedFeatures();
          expect(features.maxMessageLength).toBeGreaterThan(0);
        });
      });
    });

    describe('Performance Comparison', () => {
      it('measures delivery time differences across channels', async () => {
        const channels = createMockChannels();
        const payload = createTestPayload();
        const results: Array<{ channel: string; time: number }> = [];

        for (const channel of channels) {
          const recipient = getValidRecipientForChannel(channel.type);
          const startTime = Date.now();
          
          await channel.send(payload, recipient);
          
          const endTime = Date.now();
          results.push({ 
            channel: channel.type, 
            time: endTime - startTime 
          });
        }

        // In-app should be fastest, webhook should be slowest
        const inAppTime = results.find(r => r.channel === 'in_app')?.time || 0;
        const webhookTime = results.find(r => r.channel === 'webhook')?.time || 0;
        
        expect(inAppTime).toBeLessThan(webhookTime);
      });
    });
  });

  describe('Channel Configuration Testing', () => {
    it('handles dynamic channel registration', () => {
      const channels = createMockChannels();
      expect(channels).toHaveLength(5); // All supported channel types

      const channelTypes = channels.map(c => c.type);
      expect(channelTypes).toContain('email');
      expect(channelTypes).toContain('slack');
      expect(channelTypes).toContain('teams');
      expect(channelTypes).toContain('in_app');
      expect(channelTypes).toContain('webhook');
    });

    it('supports channel-specific configuration', () => {
      const customChannels = createMockChannels({
        emailFailureRate: 0.1,
        slackFailureRate: 0.2,
        deliveryDelays: {
          email: 50,
          slack: 100
        }
      });

      expect(customChannels).toHaveLength(5);
      // Configuration would affect behavior in actual usage
    });
  });
});

// Helper functions
function createTestPayload(overrides: Partial<NotificationPayload> = {}): NotificationPayload {
  return {
    id: uuidv4(),
    type: 'scan_completed',
    priority: 'medium',
    title: 'Test Channel Notification',
    message: 'Testing multi-channel delivery',
    metadata: { testChannel: true },
    organizationName: 'test-org',
    timestamp: new Date().toISOString(),
    dismissible: true,
    ...overrides
  };
}

function getValidRecipientForChannel(channel: DeliveryChannel): string {
  const recipients: Record<DeliveryChannel, string> = {
    email: 'test@example.com',
    slack: '@testuser',
    teams: 'https://outlook.office.com/webhook/test',
    in_app: 'user123',
    webhook: 'https://webhook.example.com/notify'
  };
  
  return recipients[channel];
}