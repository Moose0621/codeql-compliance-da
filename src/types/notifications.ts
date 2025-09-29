/**
 * Enhanced Notification System Types
 * Supporting multi-channel delivery, escalation workflows, and user preferences
 */

export type NotificationType = 
  | 'security_alert' 
  | 'compliance_violation' 
  | 'workflow_failure' 
  | 'scan_completed'
  | 'rate_limit_warning'
  | 'system_maintenance';

export type DeliveryChannel = 'email' | 'slack' | 'teams' | 'webhook' | 'in_app';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export type NotificationState = 
  | 'pending' 
  | 'queued' 
  | 'sending' 
  | 'delivered' 
  | 'failed' 
  | 'escalated' 
  | 'dismissed';

export interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  notificationType: NotificationType;
  priority: NotificationPriority;
  channels: DeliveryChannel[];
  conditions: NotificationCondition[];
  escalationConfig?: EscalationConfig;
  rateLimitConfig?: RateLimitConfig;
  digestConfig?: DigestConfig;
}

export interface NotificationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'matches_regex';
  value: string | number | boolean;
}

export interface EscalationConfig {
  enabled: boolean;
  escalationDelay: number; // minutes
  maxEscalations: number;
  escalationChannels: DeliveryChannel[];
  escalationRecipients?: string[];
}

export interface RateLimitConfig {
  maxPerHour: number;
  maxPerDay: number;
  batchSize: number;
  cooldownPeriod: number; // minutes
}

export interface DigestConfig {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly';
  deliveryTime?: string; // HH:MM format
  groupBy: 'type' | 'priority' | 'repository';
}

export interface UserPreferences {
  userId: string;
  channels: {
    [key in DeliveryChannel]?: {
      enabled: boolean;
      address?: string; // email address, Slack user ID, Teams user ID, etc.
      quietHours?: {
        start: string; // HH:MM
        end: string; // HH:MM
        timezone: string;
      };
    };
  };
  notificationTypes: {
    [key in NotificationType]?: {
      enabled: boolean;
      minPriority: NotificationPriority;
      digestEnabled: boolean;
    };
  };
  globalSettings: {
    enableDigest: boolean;
    maxNotificationsPerDay: number;
    enableEscalation: boolean;
  };
}

export interface NotificationPayload {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  metadata: Record<string, any>;
  repositoryName?: string;
  organizationName: string;
  timestamp: string;
  actionUrl?: string;
  dismissible: boolean;
  expiresAt?: string;
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  channel: DeliveryChannel;
  recipient: string;
  state: NotificationState;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  deliveredAt?: string;
  errorMessage?: string;
  escalationLevel: number;
}

export interface NotificationDigest {
  id: string;
  userId: string;
  frequency: DigestConfig['frequency'];
  notifications: NotificationPayload[];
  generatedAt: string;
  deliveredAt?: string;
  state: 'pending' | 'sent' | 'failed';
}

export interface NotificationMetrics {
  totalSent: number;
  deliveryRate: number;
  failureRate: number;
  averageDeliveryTime: number; // milliseconds
  channelMetrics: {
    [key in DeliveryChannel]?: {
      sent: number;
      delivered: number;
      failed: number;
      averageDeliveryTime: number;
    };
  };
  escalationMetrics: {
    totalEscalated: number;
    escalationRate: number;
    averageEscalationTime: number;
  };
}

// Service interfaces for dependency injection and testing
export interface NotificationChannel {
  readonly type: DeliveryChannel;
  send(payload: NotificationPayload, recipient: string): Promise<NotificationDeliveryResult>;
  validateRecipient(recipient: string): boolean;
  getSupportedFeatures(): ChannelFeatures;
}

export interface NotificationDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryAfter?: number; // seconds
}

export interface ChannelFeatures {
  supportsRichText: boolean;
  supportsButtons: boolean;
  supportsImages: boolean;
  maxMessageLength: number;
  supportsBatching: boolean;
}

export interface NotificationService {
  sendNotification(payload: NotificationPayload, recipients: string[], channels: DeliveryChannel[]): Promise<NotificationDelivery[]>;
  scheduleNotification(payload: NotificationPayload, scheduledAt: Date): Promise<string>;
  cancelNotification(notificationId: string): Promise<boolean>;
  getNotificationStatus(notificationId: string): Promise<NotificationDelivery[]>;
  updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void>;
  getUserPreferences(userId: string): Promise<UserPreferences>;
  generateDigest(userId: string, frequency: DigestConfig['frequency']): Promise<NotificationDigest>;
  getNotificationMetrics(timeRange?: { start: Date; end: Date }): Promise<NotificationMetrics>;
}