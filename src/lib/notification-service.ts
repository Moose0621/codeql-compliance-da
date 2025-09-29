/**
 * Enhanced Notification Service Implementation
 * Provides multi-channel delivery, escalation workflows, and user preference management
 */

import { 
  NotificationService, 
  NotificationPayload, 
  NotificationDelivery, 
  NotificationState, 
  DeliveryChannel, 
  UserPreferences, 
  NotificationDigest, 
  NotificationMetrics,
  NotificationChannel,
  NotificationRule,
  EscalationConfig,
  RateLimitConfig,
  DigestConfig
} from '@/types/notifications';
import { logInfo, logWarn, logError } from './logger';
import { v4 as uuidv4 } from 'uuid';

export class EnhancedNotificationService implements NotificationService {
  // Rate limiting constants - should be configurable in production
  private static readonly DEFAULT_MAX_HOURLY = 50;
  private static readonly DEFAULT_MAX_DAILY = 200;
  private static readonly HOUR_IN_MS = 60 * 60 * 1000;

  private channels: Map<DeliveryChannel, NotificationChannel> = new Map();
  private userPreferences: Map<string, UserPreferences> = new Map();
  private notificationRules: Map<string, NotificationRule> = new Map();
  private deliveries: Map<string, NotificationDelivery[]> = new Map();
  private rateLimitCounters: Map<string, { hourly: number; daily: number; lastReset: Date }> = new Map();
  private pendingDigests: Map<string, NotificationPayload[]> = new Map();

  constructor(channels: NotificationChannel[] = []) {
    channels.forEach(channel => {
      this.channels.set(channel.type, channel);
    });
  }

  async sendNotification(
    payload: NotificationPayload, 
    recipients: string[], 
    channels: DeliveryChannel[]
  ): Promise<NotificationDelivery[]> {
    const deliveries: NotificationDelivery[] = [];
    
    try {
      logInfo(`Sending notification ${payload.id} to ${recipients.length} recipients via ${channels.join(', ')}`);

      for (const recipient of recipients) {
        const userPrefs = await this.getUserPreferences(recipient);
        const filteredChannels = this.filterChannelsBasedOnPreferences(channels, userPrefs, payload);
        
        for (const channelType of filteredChannels) {
          const delivery = await this.sendToChannel(payload, recipient, channelType);
          deliveries.push(delivery);
          
          // Handle rate limiting
          if (!this.checkRateLimit(recipient, channelType)) {
            delivery.state = 'failed';
            delivery.errorMessage = 'Rate limit exceeded';
            logWarn(`Rate limit exceeded for ${recipient} on ${channelType}`);
          }
        }
      }

      // Store deliveries for tracking
      this.deliveries.set(payload.id, deliveries);

      // Schedule escalations if configured
      await this.scheduleEscalations(payload, deliveries);

      return deliveries;
    } catch (error) {
      logError(`Failed to send notification ${payload.id}:`, error);
      throw error;
    }
  }

  async scheduleNotification(payload: NotificationPayload, scheduledAt: Date): Promise<string> {
    // TODO: In production, this should use a proper job scheduler like Bull, Agenda, or Azure Service Bus
    // Current implementation using setTimeout will lose scheduled notifications on service restart
    const scheduleId = uuidv4();
    const delay = scheduledAt.getTime() - Date.now();
    
    if (delay > 0) {
      logWarn(`Using setTimeout for notification scheduling is not production-ready. Consider using a persistent job scheduler.`);
      setTimeout(async () => {
        try {
          const recipients = await this.getRecipientsForNotification(payload);
          const channels = await this.getChannelsForNotification(payload);
          await this.sendNotification(payload, recipients, channels);
        } catch (error) {
          logError(`Failed to send scheduled notification ${payload.id}:`, error);
        }
      }, delay);
    }
    
    return scheduleId;
  }

  async cancelNotification(notificationId: string): Promise<boolean> {
    const deliveries = this.deliveries.get(notificationId);
    if (!deliveries) {
      return false;
    }

    let cancelledCount = 0;
    for (const delivery of deliveries) {
      if (delivery.state === 'pending' || delivery.state === 'queued') {
        delivery.state = 'dismissed';
        cancelledCount++;
      }
    }

    logInfo(`Cancelled ${cancelledCount} pending deliveries for notification ${notificationId}`);
    return cancelledCount > 0;
  }

  async getNotificationStatus(notificationId: string): Promise<NotificationDelivery[]> {
    return this.deliveries.get(notificationId) || [];
  }

  async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
    const existing = this.userPreferences.get(userId) || this.getDefaultUserPreferences(userId);
    const updated = { ...existing, ...preferences };
    this.userPreferences.set(userId, updated);
    logInfo(`Updated preferences for user ${userId}`);
  }

  async getUserPreferences(userId: string): Promise<UserPreferences> {
    return this.userPreferences.get(userId) || this.getDefaultUserPreferences(userId);
  }

  async generateDigest(userId: string, frequency: DigestConfig['frequency']): Promise<NotificationDigest> {
    const pendingNotifications = this.pendingDigests.get(userId) || [];
    const digest: NotificationDigest = {
      id: uuidv4(),
      userId,
      frequency,
      notifications: pendingNotifications,
      generatedAt: new Date().toISOString(),
      state: 'pending'
    };

    // Clear pending notifications after including in digest
    this.pendingDigests.set(userId, []);
    
    return digest;
  }

  async getNotificationMetrics(timeRange?: { start: Date; end: Date }): Promise<NotificationMetrics> {
    // In a real implementation, this would query a metrics database
    const allDeliveries = Array.from(this.deliveries.values()).flat();
    
    const filteredDeliveries = timeRange 
      ? allDeliveries.filter(d => {
          const deliveredAt = d.deliveredAt ? new Date(d.deliveredAt) : null;
          return deliveredAt && deliveredAt >= timeRange.start && deliveredAt <= timeRange.end;
        })
      : allDeliveries;

    const totalSent = filteredDeliveries.length;
    const delivered = filteredDeliveries.filter(d => d.state === 'delivered').length;
    const failed = filteredDeliveries.filter(d => d.state === 'failed').length;
    const escalated = filteredDeliveries.filter(d => d.escalationLevel > 0).length;

    const channelMetrics: NotificationMetrics['channelMetrics'] = {};
    for (const channel of this.channels.keys()) {
      const channelDeliveries = filteredDeliveries.filter(d => d.channel === channel);
      const channelDelivered = channelDeliveries.filter(d => d.state === 'delivered').length;
      const channelFailed = channelDeliveries.filter(d => d.state === 'failed').length;
      
      channelMetrics[channel] = {
        sent: channelDeliveries.length,
        delivered: channelDelivered,
        failed: channelFailed,
        averageDeliveryTime: this.calculateAverageDeliveryTime(channelDeliveries)
      };
    }

    return {
      totalSent,
      deliveryRate: totalSent > 0 ? delivered / totalSent : 0,
      failureRate: totalSent > 0 ? failed / totalSent : 0,
      averageDeliveryTime: this.calculateAverageDeliveryTime(filteredDeliveries),
      channelMetrics,
      escalationMetrics: {
        totalEscalated: escalated,
        escalationRate: totalSent > 0 ? escalated / totalSent : 0,
        averageEscalationTime: 0 // Would calculate from escalation timestamps
      }
    };
  }

  // Private helper methods
  private async sendToChannel(
    payload: NotificationPayload, 
    recipient: string, 
    channelType: DeliveryChannel
  ): Promise<NotificationDelivery> {
    const delivery: NotificationDelivery = {
      id: uuidv4(),
      notificationId: payload.id,
      channel: channelType,
      recipient,
      state: 'pending',
      attempts: 0,
      maxAttempts: 3,
      escalationLevel: 0
    };

    const channel = this.channels.get(channelType);
    if (!channel) {
      delivery.state = 'failed';
      delivery.errorMessage = `Channel ${channelType} not available`;
      return delivery;
    }

    try {
      delivery.state = 'sending';
      delivery.attempts++;
      delivery.lastAttemptAt = new Date().toISOString();

      const result = await channel.send(payload, recipient);
      
      if (result.success) {
        delivery.state = 'delivered';
        delivery.deliveredAt = new Date().toISOString();
      } else {
        delivery.state = 'failed';
        delivery.errorMessage = result.error;
      }
    } catch (error) {
      delivery.state = 'failed';
      delivery.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError(`Failed to send via ${channelType} to ${recipient}:`, error);
    }

    return delivery;
  }

  private filterChannelsBasedOnPreferences(
    channels: DeliveryChannel[],
    userPrefs: UserPreferences,
    payload: NotificationPayload
  ): DeliveryChannel[] {
    return channels.filter(channel => {
      const channelPref = userPrefs.channels[channel];
      if (!channelPref?.enabled) return false;

      const typePref = userPrefs.notificationTypes[payload.type];
      if (!typePref?.enabled) return false;

      const priorityLevels: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical'];
      const payloadPriorityIndex = priorityLevels.indexOf(payload.priority);
      const minPriorityIndex = priorityLevels.indexOf(typePref.minPriority);
      
      return payloadPriorityIndex >= minPriorityIndex;
    });
  }

  private checkRateLimit(recipient: string, channel: DeliveryChannel): boolean {
    const key = `${recipient}:${channel}`;
    const now = new Date();
    let counters = this.rateLimitCounters.get(key);
    
    if (!counters || now.getTime() - counters.lastReset.getTime() > EnhancedNotificationService.HOUR_IN_MS) { // 1 hour
      counters = { hourly: 0, daily: 0, lastReset: now };
    }
    
    if (now.getDate() !== counters.lastReset.getDate()) {
      counters.daily = 0;
    }

    // Default rate limits - should be configurable per user/notification type
    const maxHourly = EnhancedNotificationService.DEFAULT_MAX_HOURLY;
    const maxDaily = EnhancedNotificationService.DEFAULT_MAX_DAILY;
    
    if (counters.hourly >= maxHourly || counters.daily >= maxDaily) {
      return false;
    }
    
    counters.hourly++;
    counters.daily++;
    this.rateLimitCounters.set(key, counters);
    
    return true;
  }

  private async scheduleEscalations(payload: NotificationPayload, deliveries: NotificationDelivery[]): Promise<void> {
    const failedDeliveries = deliveries.filter(d => d.state === 'failed');
    
    for (const delivery of failedDeliveries) {
      if (delivery.attempts < delivery.maxAttempts) {
        // Schedule retry with exponential backoff
        const retryDelay = Math.pow(2, delivery.attempts) * 1000; // 2^attempts seconds
        setTimeout(async () => {
          await this.retryDelivery(delivery);
        }, retryDelay);
      }
    }
  }

  private async retryDelivery(delivery: NotificationDelivery): Promise<void> {
    const channel = this.channels.get(delivery.channel);
    if (!channel || delivery.attempts >= delivery.maxAttempts) {
      return;
    }

    try {
      delivery.state = 'sending';
      delivery.attempts++;
      delivery.lastAttemptAt = new Date().toISOString();

      // Would need to reconstruct payload for retry
      // This is a simplified implementation
      logInfo(`Retrying delivery ${delivery.id} (attempt ${delivery.attempts})`);
    } catch (error) {
      logError(`Retry failed for delivery ${delivery.id}:`, error);
    }
  }

  private async getRecipientsForNotification(payload: NotificationPayload): Promise<string[]> {
    // TODO: In a real implementation, this would determine recipients based on notification rules
    // This is a placeholder that should be replaced with actual recipient logic
    logWarn('getRecipientsForNotification using placeholder implementation');
    return ['admin@example.com'];
  }

  private async getChannelsForNotification(payload: NotificationPayload): Promise<DeliveryChannel[]> {
    // TODO: In a real implementation, this would determine channels based on notification rules
    // This is a placeholder that should be replaced with actual channel determination logic
    logWarn('getChannelsForNotification using placeholder implementation');
    return ['email', 'in_app'];
  }

  private getDefaultUserPreferences(userId: string): UserPreferences {
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
      }
    };
  }

  private calculateAverageDeliveryTime(deliveries: NotificationDelivery[]): number {
    const delivered = deliveries.filter(d => d.state === 'delivered' && d.deliveredAt && d.lastAttemptAt);
    if (delivered.length === 0) return 0;

    const totalTime = delivered.reduce((sum, d) => {
      const deliveredAt = new Date(d.deliveredAt!).getTime();
      const attemptedAt = new Date(d.lastAttemptAt!).getTime();
      return sum + (deliveredAt - attemptedAt);
    }, 0);

    return totalTime / delivered.length;
  }

  // Public methods for testing and management
  public registerChannel(channel: NotificationChannel): void {
    this.channels.set(channel.type, channel);
    logInfo(`Registered notification channel: ${channel.type}`);
  }

  public getRegisteredChannels(): DeliveryChannel[] {
    return Array.from(this.channels.keys());
  }

  public addNotificationRule(rule: NotificationRule): void {
    this.notificationRules.set(rule.id, rule);
    logInfo(`Added notification rule: ${rule.name}`);
  }

  public removeNotificationRule(ruleId: string): boolean {
    const removed = this.notificationRules.delete(ruleId);
    if (removed) {
      logInfo(`Removed notification rule: ${ruleId}`);
    }
    return removed;
  }
}