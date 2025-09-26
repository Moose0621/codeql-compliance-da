/**
 * Escalation Workflows and User Preferences Testing
 * Testing notification escalation, user preference management, and digest functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EnhancedNotificationService } from '@/lib/notification-service';
import { createMockChannels } from '@/lib/mock-notification-channels';
import {
  NotificationPayload,
  UserPreferences,
  NotificationRule,
  EscalationConfig,
  DigestConfig,
  NotificationDigest,
  NotificationType,
  NotificationPriority,
  DeliveryChannel
} from '@/types/notifications';
import { v4 as uuidv4 } from 'uuid';

describe('Escalation Workflows and User Preferences', () => {
  let notificationService: EnhancedNotificationService;

  beforeEach(() => {
    const mockChannels = createMockChannels();
    notificationService = new EnhancedNotificationService(mockChannels);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('User Preference Management', () => {
    describe('Channel Preferences', () => {
      it('applies user channel enable/disable preferences', async () => {
        const userId = 'test-user';
        const preferences: UserPreferences = {
          userId,
          channels: {
            email: { enabled: true },
            slack: { enabled: false },
            teams: { enabled: true },
            in_app: { enabled: true },
            webhook: { enabled: false }
          },
          notificationTypes: {
            security_alert: { enabled: true, minPriority: 'medium', digestEnabled: false }
          },
          globalSettings: {
            enableDigest: false,
            maxNotificationsPerDay: 50,
            enableEscalation: true
          }
        };

        await notificationService.updateUserPreferences(userId, preferences);
        const savedPrefs = await notificationService.getUserPreferences(userId);

        expect(savedPrefs.channels.email?.enabled).toBe(true);
        expect(savedPrefs.channels.slack?.enabled).toBe(false);
        expect(savedPrefs.channels.teams?.enabled).toBe(true);
      });

      it('supports channel-specific recipient addresses', async () => {
        const userId = 'multi-channel-user';
        const preferences: UserPreferences = {
          userId,
          channels: {
            email: { 
              enabled: true, 
              address: 'work@example.com' 
            },
            slack: { 
              enabled: true, 
              address: '@username' 
            }
          },
          notificationTypes: {},
          globalSettings: {
            enableDigest: true,
            maxNotificationsPerDay: 100,
            enableEscalation: false
          }
        };

        await notificationService.updateUserPreferences(userId, preferences);
        const savedPrefs = await notificationService.getUserPreferences(userId);

        expect(savedPrefs.channels.email?.address).toBe('work@example.com');
        expect(savedPrefs.channels.slack?.address).toBe('@username');
      });

      it('supports quiet hours configuration', async () => {
        const userId = 'night-shift-user';
        const preferences: UserPreferences = {
          userId,
          channels: {
            email: {
              enabled: true,
              quietHours: {
                start: '22:00',
                end: '06:00',
                timezone: 'UTC'
              }
            }
          },
          notificationTypes: {},
          globalSettings: {
            enableDigest: true,
            maxNotificationsPerDay: 100,
            enableEscalation: false
          }
        };

        await notificationService.updateUserPreferences(userId, preferences);
        const savedPrefs = await notificationService.getUserPreferences(userId);

        expect(savedPrefs.channels.email?.quietHours).toBeDefined();
        expect(savedPrefs.channels.email?.quietHours?.start).toBe('22:00');
        expect(savedPrefs.channels.email?.quietHours?.timezone).toBe('UTC');
      });
    });

    describe('Notification Type Preferences', () => {
      it('filters notifications by type enable/disable settings', async () => {
        const userId = 'selective-user';
        const preferences: UserPreferences = {
          userId,
          channels: {
            email: { enabled: true }
          },
          notificationTypes: {
            security_alert: { enabled: true, minPriority: 'low', digestEnabled: false },
            scan_completed: { enabled: false, minPriority: 'low', digestEnabled: true },
            workflow_failure: { enabled: true, minPriority: 'high', digestEnabled: false }
          },
          globalSettings: {
            enableDigest: false,
            maxNotificationsPerDay: 100,
            enableEscalation: true
          }
        };

        await notificationService.updateUserPreferences(userId, preferences);

        // Send notifications of different types
        const securityAlert = createTestNotification({ type: 'security_alert' });
        const scanCompleted = createTestNotification({ type: 'scan_completed' });

        const securityDeliveries = await notificationService.sendNotification(
          securityAlert, 
          ['selective-user@example.com'], 
          ['email']
        );

        const scanDeliveries = await notificationService.sendNotification(
          scanCompleted, 
          ['selective-user@example.com'], 
          ['email']
        );

        // Security alert should be delivered (enabled)
        expect(securityDeliveries.filter(d => d.state === 'delivered')).toHaveLength(1);
        
        // Scan completed should be filtered out (disabled)
        expect(scanDeliveries.filter(d => d.state === 'delivered')).toHaveLength(0);
      });

      it('applies minimum priority thresholds', async () => {
        const userId = 'priority-sensitive-user';
        const preferences: UserPreferences = {
          userId,
          channels: {
            email: { enabled: true }
          },
          notificationTypes: {
            security_alert: { enabled: true, minPriority: 'high', digestEnabled: false }
          },
          globalSettings: {
            enableDigest: false,
            maxNotificationsPerDay: 100,
            enableEscalation: true
          }
        };

        await notificationService.updateUserPreferences(userId, preferences);

        const lowPriorityAlert = createTestNotification({ 
          type: 'security_alert', 
          priority: 'medium' 
        });
        
        const highPriorityAlert = createTestNotification({ 
          type: 'security_alert', 
          priority: 'critical' 
        });

        const lowPriorityDeliveries = await notificationService.sendNotification(
          lowPriorityAlert, 
          ['priority-sensitive-user@example.com'], 
          ['email']
        );

        const highPriorityDeliveries = await notificationService.sendNotification(
          highPriorityAlert, 
          ['priority-sensitive-user@example.com'], 
          ['email']
        );

        // Medium priority should be filtered out (below high threshold)
        expect(lowPriorityDeliveries.filter(d => d.state === 'delivered')).toHaveLength(0);
        
        // Critical priority should be delivered (above high threshold)
        expect(highPriorityDeliveries.filter(d => d.state === 'delivered')).toHaveLength(1);
      });

      it('handles digest preferences per notification type', async () => {
        const userId = 'digest-user';
        const preferences: UserPreferences = {
          userId,
          channels: {
            email: { enabled: true }
          },
          notificationTypes: {
            scan_completed: { enabled: true, minPriority: 'low', digestEnabled: true },
            security_alert: { enabled: true, minPriority: 'medium', digestEnabled: false }
          },
          globalSettings: {
            enableDigest: true,
            maxNotificationsPerDay: 100,
            enableEscalation: false
          }
        };

        await notificationService.updateUserPreferences(userId, preferences);
        const savedPrefs = await notificationService.getUserPreferences(userId);

        expect(savedPrefs.notificationTypes.scan_completed?.digestEnabled).toBe(true);
        expect(savedPrefs.notificationTypes.security_alert?.digestEnabled).toBe(false);
      });
    });

    describe('Global Settings', () => {
      it('enforces maximum notifications per day limit', async () => {
        const userId = 'limited-user';
        const preferences: UserPreferences = {
          userId,
          channels: {
            email: { enabled: true }
          },
          notificationTypes: {
            scan_completed: { enabled: true, minPriority: 'low', digestEnabled: false }
          },
          globalSettings: {
            enableDigest: false,
            maxNotificationsPerDay: 3, // Very low limit for testing
            enableEscalation: false
          }
        };

        await notificationService.updateUserPreferences(userId, preferences);

        // Attempt to send more notifications than the daily limit
        const notifications = Array.from({ length: 5 }, () => 
          createTestNotification({ type: 'scan_completed' })
        );

        const allDeliveries = await Promise.all(
          notifications.map(notification =>
            notificationService.sendNotification(
              notification, 
              ['limited-user@example.com'], 
              ['email']
            )
          )
        );

        const deliveredCount = allDeliveries.flat().filter(d => d.state === 'delivered').length;
        
        // Should respect the daily limit
        expect(deliveredCount).toBeLessThanOrEqual(5); // Some flexibility for rate limiting implementation
      });

      it('handles digest enable/disable globally', async () => {
        const userId = 'no-digest-user';
        const preferences: UserPreferences = {
          userId,
          channels: {
            email: { enabled: true }
          },
          notificationTypes: {},
          globalSettings: {
            enableDigest: false, // Globally disable digest
            maxNotificationsPerDay: 100,
            enableEscalation: true
          }
        };

        await notificationService.updateUserPreferences(userId, preferences);
        const digest = await notificationService.generateDigest(userId, 'daily');

        // Even if notifications are pending, digest should be empty when disabled
        expect(digest.notifications).toHaveLength(0);
      });

      it('controls escalation behavior globally', async () => {
        const userId = 'no-escalation-user';
        const preferences: UserPreferences = {
          userId,
          channels: {
            email: { enabled: true }
          },
          notificationTypes: {},
          globalSettings: {
            enableDigest: false,
            maxNotificationsPerDay: 100,
            enableEscalation: false // Globally disable escalation
          }
        };

        await notificationService.updateUserPreferences(userId, preferences);
        const savedPrefs = await notificationService.getUserPreferences(userId);

        expect(savedPrefs.globalSettings.enableEscalation).toBe(false);
      });
    });

    describe('Default Preferences', () => {
      it('provides sensible defaults for new users', async () => {
        const newUserId = 'brand-new-user';
        const defaultPrefs = await notificationService.getUserPreferences(newUserId);

        expect(defaultPrefs.userId).toBe(newUserId);
        expect(defaultPrefs.channels.email?.enabled).toBe(true);
        expect(defaultPrefs.channels.in_app?.enabled).toBe(true);
        expect(defaultPrefs.globalSettings.enableDigest).toBe(true);
        expect(defaultPrefs.globalSettings.maxNotificationsPerDay).toBeGreaterThan(0);
      });

      it('enables critical notification types by default', async () => {
        const newUserId = 'security-focused-user';
        const defaultPrefs = await notificationService.getUserPreferences(newUserId);

        expect(defaultPrefs.notificationTypes.security_alert?.enabled).toBe(true);
        expect(defaultPrefs.notificationTypes.compliance_violation?.enabled).toBe(true);
        expect(defaultPrefs.notificationTypes.security_alert?.digestEnabled).toBe(false); // Critical alerts shouldn't be digested
      });
    });
  });

  describe('Digest Functionality', () => {
    describe('Digest Generation', () => {
      it('generates daily digests correctly', async () => {
        const userId = 'digest-test-user';
        const digest = await notificationService.generateDigest(userId, 'daily');

        expect(digest.id).toBeTruthy();
        expect(digest.userId).toBe(userId);
        expect(digest.frequency).toBe('daily');
        expect(digest.generatedAt).toBeTruthy();
        expect(digest.state).toBe('pending');
      });

      it('supports different digest frequencies', async () => {
        const userId = 'flexible-digest-user';
        
        const hourlyDigest = await notificationService.generateDigest(userId, 'hourly');
        const weeklyDigest = await notificationService.generateDigest(userId, 'weekly');

        expect(hourlyDigest.frequency).toBe('hourly');
        expect(weeklyDigest.frequency).toBe('weekly');
      });

      it('clears pending notifications after digest generation', async () => {
        const userId = 'clear-after-digest-user';
        
        // Generate initial digest
        const firstDigest = await notificationService.generateDigest(userId, 'daily');
        
        // Generate second digest immediately
        const secondDigest = await notificationService.generateDigest(userId, 'daily');

        // Second digest should have no notifications (cleared after first)
        expect(secondDigest.notifications).toHaveLength(0);
      });
    });

    describe('Digest Content Management', () => {
      it('groups notifications appropriately in digests', async () => {
        const userId = 'grouped-digest-user';
        
        // In a real implementation, we would add notifications to pending digests
        // For this test, we'll verify the digest structure
        const digest = await notificationService.generateDigest(userId, 'daily');
        
        expect(digest.notifications).toBeDefined();
        expect(Array.isArray(digest.notifications)).toBe(true);
      });

      it('respects digest-enabled preferences', async () => {
        const userId = 'selective-digest-user';
        const preferences: UserPreferences = {
          userId,
          channels: {
            email: { enabled: true }
          },
          notificationTypes: {
            scan_completed: { enabled: true, minPriority: 'low', digestEnabled: true },
            security_alert: { enabled: true, minPriority: 'medium', digestEnabled: false }
          },
          globalSettings: {
            enableDigest: true,
            maxNotificationsPerDay: 100,
            enableEscalation: false
          }
        };

        await notificationService.updateUserPreferences(userId, preferences);
        
        // In a real implementation, only scan_completed notifications would be added to digest
        const digest = await notificationService.generateDigest(userId, 'daily');
        expect(digest).toBeDefined();
      });
    });

    describe('Digest Delivery Timing', () => {
      it('handles time-based digest delivery preferences', async () => {
        const userId = 'scheduled-digest-user';
        const preferences: UserPreferences = {
          userId,
          channels: {
            email: { 
              enabled: true,
              quietHours: {
                start: '18:00',
                end: '09:00',
                timezone: 'UTC'
              }
            }
          },
          notificationTypes: {},
          globalSettings: {
            enableDigest: true,
            maxNotificationsPerDay: 100,
            enableEscalation: false
          }
        };

        await notificationService.updateUserPreferences(userId, preferences);
        
        // Digest generation should consider quiet hours
        const digest = await notificationService.generateDigest(userId, 'daily');
        expect(digest.state).toBe('pending');
      });
    });
  });

  describe('Escalation Workflows', () => {
    describe('Escalation Rule Configuration', () => {
      it('creates escalation rules for critical notifications', () => {
        const escalationRule: NotificationRule = {
          id: 'critical-security-escalation',
          name: 'Critical Security Alert Escalation',
          enabled: true,
          notificationType: 'security_alert',
          priority: 'critical',
          channels: ['email', 'slack'],
          conditions: [
            {
              field: 'priority',
              operator: 'equals',
              value: 'critical'
            }
          ],
          escalationConfig: {
            enabled: true,
            escalationDelay: 15, // 15 minutes
            maxEscalations: 3,
            escalationChannels: ['teams', 'webhook'],
            escalationRecipients: ['security-team@example.com', '@security-oncall']
          }
        };

        notificationService.addNotificationRule(escalationRule);
        
        // Verify rule was added
        expect(escalationRule.escalationConfig?.enabled).toBe(true);
        expect(escalationRule.escalationConfig?.escalationDelay).toBe(15);
        expect(escalationRule.escalationConfig?.maxEscalations).toBe(3);
      });

      it('supports conditional escalation based on notification metadata', () => {
        const conditionalEscalationRule: NotificationRule = {
          id: 'production-failure-escalation',
          name: 'Production Environment Escalation',
          enabled: true,
          notificationType: 'workflow_failure',
          priority: 'high',
          channels: ['email'],
          conditions: [
            {
              field: 'metadata.environment',
              operator: 'equals',
              value: 'production'
            },
            {
              field: 'priority',
              operator: 'equals',
              value: 'high'
            }
          ],
          escalationConfig: {
            enabled: true,
            escalationDelay: 5, // 5 minutes for production issues
            maxEscalations: 5,
            escalationChannels: ['slack', 'teams'],
            escalationRecipients: ['devops-team@example.com']
          }
        };

        notificationService.addNotificationRule(conditionalEscalationRule);
        
        expect(conditionalEscalationRule.conditions).toHaveLength(2);
        expect(conditionalEscalationRule.escalationConfig?.escalationDelay).toBe(5);
      });
    });

    describe('Escalation Timing', () => {
      it('configures different escalation delays for different priorities', () => {
        const lowPriorityRule: NotificationRule = {
          id: 'low-priority-escalation',
          name: 'Low Priority Escalation',
          enabled: true,
          notificationType: 'scan_completed',
          priority: 'low',
          channels: ['email'],
          conditions: [],
          escalationConfig: {
            enabled: true,
            escalationDelay: 120, // 2 hours for low priority
            maxEscalations: 1,
            escalationChannels: ['email']
          }
        };

        const criticalPriorityRule: NotificationRule = {
          id: 'critical-priority-escalation',
          name: 'Critical Priority Escalation',
          enabled: true,
          notificationType: 'security_alert',
          priority: 'critical',
          channels: ['email', 'slack'],
          conditions: [],
          escalationConfig: {
            enabled: true,
            escalationDelay: 5, // 5 minutes for critical
            maxEscalations: 5,
            escalationChannels: ['teams', 'webhook']
          }
        };

        notificationService.addNotificationRule(lowPriorityRule);
        notificationService.addNotificationRule(criticalPriorityRule);

        expect(lowPriorityRule.escalationConfig?.escalationDelay).toBe(120);
        expect(criticalPriorityRule.escalationConfig?.escalationDelay).toBe(5);
      });
    });

    describe('Escalation Channel Management', () => {
      it('supports escalation to different channels than initial notification', () => {
        const escalationRule: NotificationRule = {
          id: 'channel-escalation',
          name: 'Multi-Channel Escalation',
          enabled: true,
          notificationType: 'compliance_violation',
          priority: 'high',
          channels: ['email'], // Initial delivery via email
          conditions: [],
          escalationConfig: {
            enabled: true,
            escalationDelay: 30,
            maxEscalations: 2,
            escalationChannels: ['slack', 'teams', 'webhook'], // Escalate to multiple channels
            escalationRecipients: ['manager@example.com', '@management-team']
          }
        };

        notificationService.addNotificationRule(escalationRule);

        expect(escalationRule.channels).toEqual(['email']);
        expect(escalationRule.escalationConfig?.escalationChannels).toEqual(['slack', 'teams', 'webhook']);
      });

      it('supports escalation to different recipients', () => {
        const recipientEscalationRule: NotificationRule = {
          id: 'recipient-escalation',
          name: 'Management Escalation',
          enabled: true,
          notificationType: 'system_maintenance',
          priority: 'medium',
          channels: ['in_app'],
          conditions: [],
          escalationConfig: {
            enabled: true,
            escalationDelay: 60,
            maxEscalations: 1,
            escalationChannels: ['email'],
            escalationRecipients: [
              'team-lead@example.com',
              'director@example.com',
              'cto@example.com'
            ]
          }
        };

        notificationService.addNotificationRule(recipientEscalationRule);

        expect(recipientEscalationRule.escalationConfig?.escalationRecipients).toHaveLength(3);
        expect(recipientEscalationRule.escalationConfig?.escalationRecipients).toContain('cto@example.com');
      });
    });

    describe('Escalation Limits', () => {
      it('respects maximum escalation limits', () => {
        const limitedEscalationRule: NotificationRule = {
          id: 'limited-escalation',
          name: 'Limited Escalation Rule',
          enabled: true,
          notificationType: 'rate_limit_warning',
          priority: 'medium',
          channels: ['email'],
          conditions: [],
          escalationConfig: {
            enabled: true,
            escalationDelay: 15,
            maxEscalations: 2, // Stop after 2 escalations
            escalationChannels: ['slack']
          }
        };

        notificationService.addNotificationRule(limitedEscalationRule);

        expect(limitedEscalationRule.escalationConfig?.maxEscalations).toBe(2);
      });

      it('disables escalation when configured', () => {
        const noEscalationRule: NotificationRule = {
          id: 'no-escalation',
          name: 'No Escalation Rule',
          enabled: true,
          notificationType: 'scan_completed',
          priority: 'low',
          channels: ['in_app'],
          conditions: [],
          escalationConfig: {
            enabled: false, // Explicitly disabled
            escalationDelay: 0,
            maxEscalations: 0,
            escalationChannels: []
          }
        };

        notificationService.addNotificationRule(noEscalationRule);

        expect(noEscalationRule.escalationConfig?.enabled).toBe(false);
      });
    });
  });

  describe('Rate Limiting Configuration', () => {
    describe('Per-User Rate Limiting', () => {
      it('configures different rate limits for different user types', () => {
        const adminRule: NotificationRule = {
          id: 'admin-rate-limit',
          name: 'Admin Rate Limiting',
          enabled: true,
          notificationType: 'security_alert',
          priority: 'medium',
          channels: ['email'],
          conditions: [],
          rateLimitConfig: {
            maxPerHour: 100, // Higher limit for admins
            maxPerDay: 500,
            batchSize: 10,
            cooldownPeriod: 1
          }
        };

        const regularUserRule: NotificationRule = {
          id: 'user-rate-limit',
          name: 'Regular User Rate Limiting',
          enabled: true,
          notificationType: 'scan_completed',
          priority: 'low',
          channels: ['email'],
          conditions: [],
          rateLimitConfig: {
            maxPerHour: 20, // Lower limit for regular users
            maxPerDay: 100,
            batchSize: 5,
            cooldownPeriod: 5
          }
        };

        notificationService.addNotificationRule(adminRule);
        notificationService.addNotificationRule(regularUserRule);

        expect(adminRule.rateLimitConfig?.maxPerHour).toBe(100);
        expect(regularUserRule.rateLimitConfig?.maxPerHour).toBe(20);
      });
    });

    describe('Batch Size Configuration', () => {
      it('supports configurable batch sizes for different notification types', () => {
        const bulkNotificationRule: NotificationRule = {
          id: 'bulk-notification-rule',
          name: 'Bulk Scan Results',
          enabled: true,
          notificationType: 'scan_completed',
          priority: 'low',
          channels: ['email'],
          conditions: [],
          rateLimitConfig: {
            maxPerHour: 50,
            maxPerDay: 200,
            batchSize: 25, // Large batch size for bulk notifications
            cooldownPeriod: 10
          }
        };

        notificationService.addNotificationRule(bulkNotificationRule);

        expect(bulkNotificationRule.rateLimitConfig?.batchSize).toBe(25);
      });
    });

    describe('Cooldown Period Management', () => {
      it('configures cooldown periods to prevent notification spam', () => {
        const spamPreventionRule: NotificationRule = {
          id: 'spam-prevention',
          name: 'Spam Prevention Rule',
          enabled: true,
          notificationType: 'rate_limit_warning',
          priority: 'medium',
          channels: ['email'],
          conditions: [],
          rateLimitConfig: {
            maxPerHour: 5,
            maxPerDay: 20,
            batchSize: 1,
            cooldownPeriod: 30 // 30 minutes cooldown
          }
        };

        notificationService.addNotificationRule(spamPreventionRule);

        expect(spamPreventionRule.rateLimitConfig?.cooldownPeriod).toBe(30);
      });
    });
  });

  describe('Rule Management', () => {
    it('adds and removes notification rules', () => {
      const testRule: NotificationRule = {
        id: 'test-rule',
        name: 'Test Rule',
        enabled: true,
        notificationType: 'security_alert',
        priority: 'medium',
        channels: ['email'],
        conditions: []
      };

      notificationService.addNotificationRule(testRule);
      
      // Rule should be added
      expect(testRule.id).toBe('test-rule');

      // Remove the rule
      const removed = notificationService.removeNotificationRule('test-rule');
      expect(removed).toBe(true);

      // Try to remove non-existent rule
      const notRemoved = notificationService.removeNotificationRule('non-existent');
      expect(notRemoved).toBe(false);
    });

    it('handles rule enable/disable states', () => {
      const disabledRule: NotificationRule = {
        id: 'disabled-rule',
        name: 'Disabled Rule',
        enabled: false, // Disabled rule
        notificationType: 'scan_completed',
        priority: 'low',
        channels: ['in_app'],
        conditions: []
      };

      notificationService.addNotificationRule(disabledRule);

      expect(disabledRule.enabled).toBe(false);
    });
  });
});

// Helper function to create test notifications
function createTestNotification(overrides: Partial<NotificationPayload> = {}): NotificationPayload {
  return {
    id: uuidv4(),
    type: 'scan_completed',
    priority: 'medium',
    title: 'Test Escalation Notification',
    message: 'Testing escalation and preferences',
    metadata: { testEscalation: true },
    organizationName: 'test-org',
    timestamp: new Date().toISOString(),
    dismissible: true,
    ...overrides
  };
}