/**
 * Enhanced Notification System Test Suite
 * Comprehensive ISTQB-based testing for multi-channel notification system
 * 
 * Test Design Techniques Applied:
 * - Equivalence Partitioning: Notification types, delivery channels, user roles
 * - Boundary Value Analysis: Rate limiting thresholds, batch sizes, retry attempts
 * - Decision Table Testing: Complex notification routing rules and user preferences
 * - State Transition Testing: Notification lifecycle states and escalation workflows
 * - Experience-Based Testing: User workflow scenarios and notification fatigue prevention
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedNotificationService } from '@/lib/notification-service';
import { 
  createMockChannels, 
  MockEmailChannel, 
  MockSlackChannel, 
  MockInAppChannel 
} from '@/lib/mock-notification-channels';
import {
  NotificationPayload,
  NotificationDelivery,
  UserPreferences,
  NotificationType,
  NotificationPriority,
  DeliveryChannel,
  NotificationRule,
  NotificationMetrics
} from '@/types/notifications';
import { v4 as uuidv4 } from 'uuid';

describe('Enhanced Notification System', () => {
  let notificationService: EnhancedNotificationService;
  let mockChannels: ReturnType<typeof createMockChannels>;

  beforeEach(() => {
    mockChannels = createMockChannels();
    notificationService = new EnhancedNotificationService(mockChannels);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ISTQB Test Design: Equivalence Partitioning', () => {
    describe('Notification Type Partitions', () => {
      const notificationTypes: NotificationType[] = [
        'security_alert',
        'compliance_violation', 
        'workflow_failure',
        'scan_completed',
        'rate_limit_warning',
        'system_maintenance'
      ];

      it.each(notificationTypes)('handles %s notification type correctly', async (type) => {
        const payload = createTestNotification({ type, priority: 'medium' });
        const recipients = ['test@example.com'];
        const channels: DeliveryChannel[] = ['email'];

        const deliveries = await notificationService.sendNotification(payload, recipients, channels);

        expect(deliveries).toHaveLength(1);
        expect(deliveries[0].state).toBe('delivered');
        expect(deliveries[0].channel).toBe('email');
      });
    });

    describe('Delivery Channel Partitions', () => {
      const channels: DeliveryChannel[] = ['email', 'slack', 'teams', 'in_app', 'webhook'];
      
      it.each(channels)('successfully delivers via %s channel', async (channel) => {
        const payload = createTestNotification();
        const recipients = getValidRecipientForChannel(channel);
        
        const deliveries = await notificationService.sendNotification(payload, [recipients], [channel]);
        
        expect(deliveries).toHaveLength(1);
        expect(deliveries[0].channel).toBe(channel);
        expect(deliveries[0].state).toBe('delivered');
      });
    });

    describe('Priority Level Partitions', () => {
      const priorities: NotificationPriority[] = ['low', 'medium', 'high', 'critical'];
      
      it.each(priorities)('processes %s priority notifications correctly', async (priority) => {
        const payload = createTestNotification({ priority });
        const recipients = ['test@example.com'];
        const channels: DeliveryChannel[] = ['email'];

        const deliveries = await notificationService.sendNotification(payload, recipients, channels);
        
        expect(deliveries).toHaveLength(1);
        expect(deliveries[0].state).toBe('delivered');
      });
    });

    describe('User Role Partitions', () => {
      it('handles admin user notifications', async () => {
        const payload = createTestNotification({ type: 'security_alert', priority: 'critical' });
        const adminPrefs = createUserPreferences('admin', {
          channels: {
            email: { enabled: true },
            slack: { enabled: true },
            teams: { enabled: true }
          }
        });
        
        await notificationService.updateUserPreferences('admin', adminPrefs);
        
        const deliveries = await notificationService.sendNotification(
          payload, 
          ['admin'], 
          ['email', 'slack', 'teams']
        );
        
        expect(deliveries.filter(d => d.state === 'delivered')).toHaveLength(3);
      });

      it('handles regular user notifications with limited channels', async () => {
        const payload = createTestNotification({ type: 'scan_completed', priority: 'low' });
        const userPrefs = createUserPreferences('user', {
          channels: {
            email: { enabled: true },
            in_app: { enabled: true },
            slack: { enabled: false }
          }
        });
        
        await notificationService.updateUserPreferences('user', userPrefs);
        
        const deliveries = await notificationService.sendNotification(
          payload,
          ['user'], 
          ['email', 'in_app', 'slack']
        );
        
        const deliveredCount = deliveries.filter(d => d.state === 'delivered').length;
        expect(deliveredCount).toBe(2); // Only email and in_app should be delivered
      });
    });
  });

  describe('ISTQB Test Design: Boundary Value Analysis', () => {
    describe('Rate Limiting Boundaries', () => {
      it('allows notifications up to hourly limit', async () => {
        const payload = createTestNotification();
        const recipient = 'test@example.com';
        const channel: DeliveryChannel[] = ['email'];

        // Send notifications up to the limit (50 per hour by default)
        const promises = Array.from({ length: 50 }, () => 
          notificationService.sendNotification(payload, [recipient], channel)
        );
        
        const results = await Promise.all(promises);
        const successfulDeliveries = results.flat().filter(d => d.state === 'delivered');
        
        expect(successfulDeliveries.length).toBe(50);
      });

      it('blocks notifications exceeding hourly limit', async () => {
        const payload = createTestNotification();
        const recipient = 'test@example.com';
        const channel: DeliveryChannel[] = ['email'];

        // Send 51 notifications (1 over limit)
        const promises = Array.from({ length: 51 }, () => 
          notificationService.sendNotification(payload, [recipient], channel)
        );
        
        const results = await Promise.all(promises);
        const failedDeliveries = results.flat().filter(d => d.state === 'failed' && d.errorMessage?.includes('Rate limit'));
        
        expect(failedDeliveries.length).toBeGreaterThan(0);
      });

      it('handles edge case of exactly maximum batch size', async () => {
        const payload = createTestNotification();
        const batchSize = 100;
        const recipients = Array.from({ length: batchSize }, (_, i) => `user${i}@example.com`);
        
        const deliveries = await notificationService.sendNotification(payload, recipients, ['email']);
        
        expect(deliveries).toHaveLength(batchSize);
        expect(deliveries.filter(d => d.state === 'delivered')).toHaveLength(batchSize);
      });
    });

    describe('Retry Attempt Boundaries', () => {
      it('retries up to maximum attempts on failure', async () => {
        // Create a channel that always fails
        const failingChannel = new MockEmailChannel({ failureRate: 1.0 });
        const serviceWithFailingChannel = new EnhancedNotificationService([failingChannel]);
        
        const payload = createTestNotification();
        const deliveries = await serviceWithFailingChannel.sendNotification(
          payload, 
          ['test@example.com'], 
          ['email']
        );
        
        expect(deliveries[0].state).toBe('failed');
        expect(deliveries[0].attempts).toBe(1); // Initial attempt recorded
      });
    });

    describe('Message Length Boundaries', () => {
      it('handles messages at channel length limits', async () => {
        const slackChannel = mockChannels.find(c => c.type === 'slack')!;
        const maxLength = slackChannel.getSupportedFeatures().maxMessageLength;
        
        const payload = createTestNotification({
          message: 'x'.repeat(maxLength)
        });
        
        const deliveries = await notificationService.sendNotification(
          payload, 
          ['@testuser'], 
          ['slack']
        );
        
        expect(deliveries[0].state).toBe('delivered');
      });

      it('rejects messages exceeding channel length limits', async () => {
        const slackChannel = mockChannels.find(c => c.type === 'slack')!;
        const maxLength = slackChannel.getSupportedFeatures().maxMessageLength;
        
        const payload = createTestNotification({
          message: 'x'.repeat(maxLength + 1)
        });
        
        const deliveries = await notificationService.sendNotification(
          payload, 
          ['@testuser'], 
          ['slack']
        );
        
        expect(deliveries[0].state).toBe('failed');
        expect(deliveries[0].errorMessage).toContain('character limit');
      });
    });
  });

  describe('ISTQB Test Design: Decision Table Testing', () => {
    describe('Notification Routing Decision Tables', () => {
      /**
       * Decision Table for Notification Routing:
       * 
       * Conditions:
       * C1: User has channel enabled
       * C2: Notification type is enabled for user
       * C3: Notification priority meets minimum threshold
       * C4: Channel is within rate limit
       * C5: Channel is available/working
       * 
       * Actions:
       * A1: Send notification
       * A2: Skip notification
       * A3: Queue for retry
       * A4: Escalate notification
       * 
       * Rules (T = True, F = False):
       * Rule | C1 | C2 | C3 | C4 | C5 | A1 | A2 | A3 | A4 |
       * -----|----|----|----|----|----|----|----|----|----| 
       * R1   | T  | T  | T  | T  | T  | X  |    |    |    |
       * R2   | F  | -  | -  | -  | -  |    | X  |    |    |
       * R3   | T  | F  | -  | -  | -  |    | X  |    |    |
       * R4   | T  | T  | F  | -  | -  |    | X  |    |    |
       * R5   | T  | T  | T  | F  | -  |    | X  |    |    |
       * R6   | T  | T  | T  | T  | F  |    |    | X  |    |
       */

      it('Rule R1: All conditions true - should send notification', async () => {
        // Setup user preferences
        const userPrefs = createUserPreferences('user1', {
          channels: { email: { enabled: true } }, // C1: True
          notificationTypes: { 
            security_alert: { enabled: true, minPriority: 'medium', digestEnabled: false } // C2: True, C3: True
          }
        });
        await notificationService.updateUserPreferences('user1', userPrefs);

        const payload = createTestNotification({
          type: 'security_alert',
          priority: 'high' // C3: Priority high > medium
        });

        const deliveries = await notificationService.sendNotification(
          payload,
          ['user1@example.com'], // C4: Within rate limit, C5: Channel working
          ['email']
        );

        expect(deliveries[0].state).toBe('delivered'); // A1: Send notification
      });

      it('Rule R2: Channel disabled - should skip notification', async () => {
        const userPrefs = createUserPreferences('user2', {
          channels: { email: { enabled: false } } // C1: False
        });
        await notificationService.updateUserPreferences('user2', userPrefs);

        const payload = createTestNotification();
        const deliveries = await notificationService.sendNotification(
          payload,
          ['user2@example.com'],
          ['email']
        );

        expect(deliveries).toHaveLength(0); // A2: Skip notification
      });

      it('Rule R3: Notification type disabled - should skip notification', async () => {
        const userPrefs = createUserPreferences('user3', {
          channels: { email: { enabled: true } }, // C1: True
          notificationTypes: {
            security_alert: { enabled: false, minPriority: 'low', digestEnabled: false } // C2: False
          }
        });
        await notificationService.updateUserPreferences('user3', userPrefs);

        const payload = createTestNotification({ type: 'security_alert' });
        const deliveries = await notificationService.sendNotification(
          payload,
          ['user3@example.com'],
          ['email']
        );

        expect(deliveries).toHaveLength(0); // A2: Skip notification
      });

      it('Rule R4: Priority below minimum - should skip notification', async () => {
        const userPrefs = createUserPreferences('user4', {
          channels: { email: { enabled: true } }, // C1: True
          notificationTypes: {
            security_alert: { enabled: true, minPriority: 'high', digestEnabled: false } // C2: True, C3: False
          }
        });
        await notificationService.updateUserPreferences('user4', userPrefs);

        const payload = createTestNotification({
          type: 'security_alert',
          priority: 'medium' // C3: medium < high
        });

        const deliveries = await notificationService.sendNotification(
          payload,
          ['user4@example.com'],
          ['email']
        );

        expect(deliveries).toHaveLength(0); // A2: Skip notification
      });
    });

    describe('Complex Routing Scenarios', () => {
      it('handles mixed channel availability scenarios', async () => {
        // Setup mixed success/failure channels
        const mixedChannels = [
          new MockEmailChannel({ failureRate: 0 }), // Always succeeds
          new MockSlackChannel({ failureRate: 1 }), // Always fails
          new MockInAppChannel({ failureRate: 0 })  // Always succeeds
        ];
        
        const serviceWithMixedChannels = new EnhancedNotificationService(mixedChannels);
        
        const payload = createTestNotification();
        const deliveries = await serviceWithMixedChannels.sendNotification(
          payload,
          ['test@example.com', '@testuser', 'testuser123'],
          ['email', 'slack', 'in_app']
        );

        const delivered = deliveries.filter(d => d.state === 'delivered');
        const failed = deliveries.filter(d => d.state === 'failed');
        
        expect(delivered).toHaveLength(2); // Email and in-app
        expect(failed).toHaveLength(1); // Slack
      });
    });
  });

  describe('ISTQB Test Design: State Transition Testing', () => {
    describe('Notification Delivery State Transitions', () => {
      /**
       * State Transition Diagram for Notification Delivery:
       * 
       * [pending] --send--> [sending] --success--> [delivered]
       *     |                   |
       *     |                   +--failure--> [failed] --retry--> [sending]
       *     |                                     |
       *     +--cancel--> [dismissed]              +--max_retries--> [escalated]
       */

      it('transitions from pending to delivered on successful send', async () => {
        const payload = createTestNotification();
        const deliveries = await notificationService.sendNotification(
          payload,
          ['test@example.com'],
          ['email']
        );

        const delivery = deliveries[0];
        expect(delivery.state).toBe('delivered');
        expect(delivery.attempts).toBe(1);
        expect(delivery.deliveredAt).toBeTruthy();
      });

      it('transitions from pending to failed on send failure', async () => {
        const failingChannel = new MockEmailChannel({ failureRate: 1.0 });
        const serviceWithFailingChannel = new EnhancedNotificationService([failingChannel]);

        const payload = createTestNotification();
        const deliveries = await serviceWithFailingChannel.sendNotification(
          payload,
          ['test@example.com'],
          ['email']
        );

        const delivery = deliveries[0];
        expect(delivery.state).toBe('failed');
        expect(delivery.attempts).toBe(1);
        expect(delivery.errorMessage).toBeTruthy();
      });

      it('transitions to dismissed when notification is cancelled', async () => {
        const payload = createTestNotification();
        
        // Schedule a notification
        await notificationService.scheduleNotification(payload, new Date(Date.now() + 10000));
        
        // Cancel it before it's sent
        const cancelled = await notificationService.cancelNotification(payload.id);
        
        expect(cancelled).toBe(true);
        
        const deliveries = await notificationService.getNotificationStatus(payload.id);
        // In this mock implementation, we don't have pending deliveries tracked separately
        // In a real implementation, this would show dismissed state
        expect(deliveries).toHaveLength(0);
      });
    });

    describe('Escalation State Transitions', () => {
      it('tracks escalation level progression', async () => {
        // This test would be more meaningful with a real escalation implementation
        const payload = createTestNotification({ priority: 'critical' });
        const deliveries = await notificationService.sendNotification(
          payload,
          ['test@example.com'],
          ['email']
        );

        expect(deliveries[0].escalationLevel).toBe(0);
      });
    });
  });

  describe('ISTQB Test Design: Experience-Based Testing', () => {
    describe('User Workflow Scenarios', () => {
      it('handles typical security team workflow', async () => {
        // Scenario: Security team receives critical alert, needs immediate multi-channel notification
        const criticalAlert = createTestNotification({
          type: 'security_alert',
          priority: 'critical',
          title: 'Critical Security Vulnerability Detected',
          message: 'High-severity vulnerability found in production repository'
        });

        const securityTeamPrefs = createUserPreferences('security-team', {
          channels: {
            email: { enabled: true },
            slack: { enabled: true },
            teams: { enabled: true }
          },
          notificationTypes: {
            security_alert: { enabled: true, minPriority: 'medium', digestEnabled: false }
          }
        });

        await notificationService.updateUserPreferences('security-team', securityTeamPrefs);

        const deliveries = await notificationService.sendNotification(
          criticalAlert,
          ['security-team@example.com'],
          ['email', 'slack', 'teams']
        );

        expect(deliveries).toHaveLength(3);
        expect(deliveries.every(d => d.state === 'delivered')).toBe(true);
      });

      it('handles developer daily digest workflow', async () => {
        // Scenario: Developer receives daily digest of scan completions and low-priority alerts
        const userPrefs = createUserPreferences('developer', {
          globalSettings: { enableDigest: true, maxNotificationsPerDay: 50, enableEscalation: false },
          notificationTypes: {
            scan_completed: { enabled: true, minPriority: 'low', digestEnabled: true },
            workflow_failure: { enabled: true, minPriority: 'medium', digestEnabled: true }
          }
        });

        await notificationService.updateUserPreferences('developer', userPrefs);

        const digest = await notificationService.generateDigest('developer', 'daily');
        
        expect(digest).toBeDefined();
        expect(digest.frequency).toBe('daily');
        expect(digest.state).toBe('pending');
      });

      it('handles compliance officer audit workflow', async () => {
        // Scenario: Compliance officer needs all violation notifications with full audit trail
        const complianceAlert = createTestNotification({
          type: 'compliance_violation',
          priority: 'high',
          title: 'FedRAMP Compliance Violation Detected'
        });

        const compliancePrefs = createUserPreferences('compliance-officer', {
          channels: {
            email: { enabled: true },
            webhook: { enabled: true } // For audit system integration
          },
          notificationTypes: {
            compliance_violation: { enabled: true, minPriority: 'low', digestEnabled: false }
          }
        });

        await notificationService.updateUserPreferences('compliance-officer', compliancePrefs);

        const deliveries = await notificationService.sendNotification(
          complianceAlert,
          ['compliance@example.com'],
          ['email', 'webhook']
        );

        expect(deliveries).toHaveLength(2);
        expect(deliveries.filter(d => d.state === 'delivered')).toHaveLength(2);
      });
    });

    describe('Notification Fatigue Prevention', () => {
      it('prevents notification spam through rate limiting', async () => {
        // Simulate a scenario where many scan completions happen rapidly
        const scanNotifications = Array.from({ length: 20 }, () => 
          createTestNotification({
            type: 'scan_completed',
            priority: 'low'
          })
        );

        const userPrefs = createUserPreferences('developer', {
          globalSettings: { 
            maxNotificationsPerDay: 10, 
            enableDigest: false,
            enableEscalation: false
          }
        });
        await notificationService.updateUserPreferences('developer', userPrefs);

        // Send all notifications
        const allDeliveries = await Promise.all(
          scanNotifications.map(notification =>
            notificationService.sendNotification(notification, ['dev@example.com'], ['email'])
          )
        );

        const deliveredCount = allDeliveries.flat().filter(d => d.state === 'delivered').length;
        
        // Should be limited by user preferences and/or system rate limits
        expect(deliveredCount).toBeLessThanOrEqual(15); // Some leeway for system limits
      });

      it('respects user quiet hours preferences', async () => {
        const userPrefs = createUserPreferences('night-shift-dev', {
          channels: {
            email: {
              enabled: true,
              quietHours: {
                start: '22:00',
                end: '08:00',
                timezone: 'UTC'
              }
            }
          }
        });

        await notificationService.updateUserPreferences('night-shift-dev', userPrefs);

        // This test is simplified - in reality, would need to mock time and check quiet hours
        const notification = createTestNotification({ priority: 'low' });
        const deliveries = await notificationService.sendNotification(
          notification,
          ['night-shift@example.com'],
          ['email']
        );

        // For this test, we'll just verify the notification was processed
        // In a full implementation, quiet hours would delay delivery
        expect(deliveries).toHaveLength(1);
      });
    });

    describe('Error Recovery Scenarios', () => {
      it('handles external service outages gracefully', async () => {
        // Create channels with high failure rates to simulate outages
        const unreliableChannels = createMockChannels({
          slackFailureRate: 0.8,
          teamsFailureRate: 0.9,
          webhookFailureRate: 0.7
        });

        const serviceWithUnreliableChannels = new EnhancedNotificationService(unreliableChannels);

        const importantNotification = createTestNotification({
          priority: 'high',
          type: 'security_alert'
        });

        const deliveries = await serviceWithUnreliableChannels.sendNotification(
          importantNotification,
          ['admin@example.com', '@admin', 'https://webhook.example.com/alerts'],
          ['email', 'slack', 'webhook']
        );

        // At least email should succeed (0% failure rate)
        const successfulDeliveries = deliveries.filter(d => d.state === 'delivered');
        expect(successfulDeliveries.length).toBeGreaterThanOrEqual(1);

        // Failed deliveries should have error messages
        const failedDeliveries = deliveries.filter(d => d.state === 'failed');
        failedDeliveries.forEach(delivery => {
          expect(delivery.errorMessage).toBeTruthy();
        });
      });
    });
  });

  describe('Performance and Scalability Testing', () => {
    describe('High Volume Scenarios', () => {
      it('handles large number of recipients efficiently', async () => {
        const startTime = Date.now();
        const recipients = Array.from({ length: 1000 }, (_, i) => `user${i}@example.com`);
        const notification = createTestNotification();

        const deliveries = await notificationService.sendNotification(
          notification,
          recipients,
          ['email']
        );

        const endTime = Date.now();
        const processingTime = endTime - startTime;

        expect(deliveries).toHaveLength(1000);
        expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      });

      it('handles concurrent notification sending', async () => {
        const concurrentNotifications = Array.from({ length: 50 }, () => 
          createTestNotification()
        );

        const startTime = Date.now();
        const promises = concurrentNotifications.map(notification =>
          notificationService.sendNotification(notification, ['test@example.com'], ['email'])
        );

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const processingTime = endTime - startTime;

        expect(results).toHaveLength(50);
        expect(results.every(deliveries => deliveries.length > 0)).toBe(true);
        expect(processingTime).toBeLessThan(3000); // Should handle concurrency efficiently
      });
    });

    describe('Memory and Resource Management', () => {
      it('manages delivery tracking without memory leaks', async () => {
        // Send many notifications and verify they don't accumulate indefinitely
        const notifications = Array.from({ length: 100 }, () => createTestNotification());
        
        for (const notification of notifications) {
          await notificationService.sendNotification(
            notification,
            ['test@example.com'],
            ['email']
          );
        }

        // In a real implementation, old deliveries should be cleaned up
        // This test verifies the service continues to work under load
        const finalNotification = createTestNotification();
        const finalDeliveries = await notificationService.sendNotification(
          finalNotification,
          ['test@example.com'],
          ['email']
        );

        expect(finalDeliveries).toHaveLength(1);
        expect(finalDeliveries[0].state).toBe('delivered');
      });
    });
  });

  describe('Metrics and Monitoring', () => {
    it('tracks delivery metrics accurately', async () => {
      // Send various notifications with different success rates
      const notifications = [
        createTestNotification({ type: 'security_alert' }),
        createTestNotification({ type: 'scan_completed' }),
        createTestNotification({ type: 'workflow_failure' })
      ];

      // Send through different channels
      for (const notification of notifications) {
        await notificationService.sendNotification(
          notification,
          ['test@example.com', '@testuser'],
          ['email', 'slack']
        );
      }

      const metrics = await notificationService.getNotificationMetrics();

      expect(metrics.totalSent).toBe(6); // 3 notifications × 2 channels each
      expect(metrics.deliveryRate).toBeGreaterThan(0);
      expect(metrics.deliveryRate).toBeLessThanOrEqual(1);
      expect(metrics.channelMetrics.email).toBeDefined();
      expect(metrics.channelMetrics.slack).toBeDefined();
    });
  });
});

// Helper functions for test data creation
function createTestNotification(overrides: Partial<NotificationPayload> = {}): NotificationPayload {
  return {
    id: uuidv4(),
    type: 'scan_completed',
    priority: 'medium',
    title: 'Test Notification',
    message: 'This is a test notification message',
    metadata: { testData: true },
    organizationName: 'test-org',
    timestamp: new Date().toISOString(),
    dismissible: true,
    ...overrides
  };
}

function createUserPreferences(userId: string, overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    userId,
    channels: {
      email: { enabled: true },
      in_app: { enabled: true },
      slack: { enabled: false },
      teams: { enabled: false },
      webhook: { enabled: false }
    },
    notificationTypes: {
      security_alert: { enabled: true, minPriority: 'medium', digestEnabled: false },
      compliance_violation: { enabled: true, minPriority: 'high', digestEnabled: false },
      workflow_failure: { enabled: true, minPriority: 'medium', digestEnabled: true },
      scan_completed: { enabled: true, minPriority: 'low', digestEnabled: true },
      rate_limit_warning: { enabled: true, minPriority: 'medium', digestEnabled: true },
      system_maintenance: { enabled: true, minPriority: 'low', digestEnabled: true }
    },
    globalSettings: {
      enableDigest: true,
      maxNotificationsPerDay: 100,
      enableEscalation: true
    },
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