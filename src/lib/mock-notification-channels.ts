/**
 * Mock Notification Channel Implementations for Testing
 * Provides various channel types with configurable behaviors for comprehensive testing
 */

import { 
  NotificationChannel, 
  NotificationPayload, 
  NotificationDeliveryResult, 
  ChannelFeatures, 
  DeliveryChannel 
} from '@/types/notifications';

export class MockEmailChannel implements NotificationChannel {
  readonly type: DeliveryChannel = 'email';
  private deliveryDelay: number;
  private failureRate: number;
  private deliveryLog: Array<{ payload: NotificationPayload; recipient: string; timestamp: Date }> = [];

  constructor(config: { deliveryDelay?: number; failureRate?: number } = {}) {
    this.deliveryDelay = config.deliveryDelay || 100;
    this.failureRate = config.failureRate || 0;
  }

  async send(payload: NotificationPayload, recipient: string): Promise<NotificationDeliveryResult> {
    // Simulate delivery delay
    await this.delay(this.deliveryDelay);
    
    this.deliveryLog.push({ payload, recipient, timestamp: new Date() });

    // Simulate failures based on configured rate
    if (Math.random() < this.failureRate) {
      return {
        success: false,
        error: 'SMTP server temporarily unavailable'
      };
    }

    // Validate email format
    if (!this.validateRecipient(recipient)) {
      return {
        success: false,
        error: 'Invalid email address format'
      };
    }

    // Simulate rate limiting
    if (payload.priority === 'low' && this.getRecentDeliveries(recipient, 3600).length > 10) {
      return {
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: 3600
      };
    }

    return {
      success: true,
      messageId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  validateRecipient(recipient: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(recipient);
  }

  getSupportedFeatures(): ChannelFeatures {
    return {
      supportsRichText: true,
      supportsButtons: true,
      supportsImages: true,
      maxMessageLength: 100000,
      supportsBatching: true
    };
  }

  // Test utilities
  getDeliveryLog(): Array<{ payload: NotificationPayload; recipient: string; timestamp: Date }> {
    return [...this.deliveryLog];
  }

  clearDeliveryLog(): void {
    this.deliveryLog = [];
  }

  private getRecentDeliveries(recipient: string, seconds: number): any[] {
    const cutoff = new Date(Date.now() - seconds * 1000);
    return this.deliveryLog.filter(
      log => log.recipient === recipient && log.timestamp >= cutoff
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class MockSlackChannel implements NotificationChannel {
  readonly type: DeliveryChannel = 'slack';
  private webhookUrl: string;
  private deliveryDelay: number;
  private failureRate: number;
  private deliveryLog: Array<{ payload: NotificationPayload; recipient: string; timestamp: Date }> = [];

  constructor(config: { webhookUrl?: string; deliveryDelay?: number; failureRate?: number } = {}) {
    this.webhookUrl = config.webhookUrl || 'https://hooks.slack.com/test';
    this.deliveryDelay = config.deliveryDelay || 50;
    this.failureRate = config.failureRate || 0;
  }

  async send(payload: NotificationPayload, recipient: string): Promise<NotificationDeliveryResult> {
    await this.delay(this.deliveryDelay);
    
    this.deliveryLog.push({ payload, recipient, timestamp: new Date() });

    if (Math.random() < this.failureRate) {
      return {
        success: false,
        error: 'Slack webhook returned 500 error'
      };
    }

    if (!this.validateRecipient(recipient)) {
      return {
        success: false,
        error: 'Invalid Slack channel or user ID'
      };
    }

    // Simulate message length limits
    if (payload.message.length > this.getSupportedFeatures().maxMessageLength) {
      return {
        success: false,
        error: 'Message exceeds Slack character limit'
      };
    }

    return {
      success: true,
      messageId: `slack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  validateRecipient(recipient: string): boolean {
    // Validate Slack channel (#channel) or user (@user) format
    return /^[#@][a-zA-Z0-9_-]+$/.test(recipient) || /^[A-Z0-9]+$/.test(recipient);
  }

  getSupportedFeatures(): ChannelFeatures {
    return {
      supportsRichText: true,
      supportsButtons: true,
      supportsImages: false,
      maxMessageLength: 4000,
      supportsBatching: false
    };
  }

  getDeliveryLog(): Array<{ payload: NotificationPayload; recipient: string; timestamp: Date }> {
    return [...this.deliveryLog];
  }

  clearDeliveryLog(): void {
    this.deliveryLog = [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class MockTeamsChannel implements NotificationChannel {
  readonly type: DeliveryChannel = 'teams';
  private webhookUrl: string;
  private deliveryDelay: number;
  private failureRate: number;
  private deliveryLog: Array<{ payload: NotificationPayload; recipient: string; timestamp: Date }> = [];

  constructor(config: { webhookUrl?: string; deliveryDelay?: number; failureRate?: number } = {}) {
    this.webhookUrl = config.webhookUrl || 'https://outlook.office.com/webhook/test';
    this.deliveryDelay = config.deliveryDelay || 75;
    this.failureRate = config.failureRate || 0;
  }

  async send(payload: NotificationPayload, recipient: string): Promise<NotificationDeliveryResult> {
    await this.delay(this.deliveryDelay);
    
    this.deliveryLog.push({ payload, recipient, timestamp: new Date() });

    if (Math.random() < this.failureRate) {
      return {
        success: false,
        error: 'Microsoft Teams webhook timeout'
      };
    }

    if (!this.validateRecipient(recipient)) {
      return {
        success: false,
        error: 'Invalid Teams webhook URL or channel ID'
      };
    }

    return {
      success: true,
      messageId: `teams_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  validateRecipient(recipient: string): boolean {
    // Validate Teams webhook URL or channel ID format
    return recipient.includes('outlook.office.com') || /^[a-f0-9-]+$/.test(recipient);
  }

  getSupportedFeatures(): ChannelFeatures {
    return {
      supportsRichText: true,
      supportsButtons: true,
      supportsImages: true,
      maxMessageLength: 28000,
      supportsBatching: false
    };
  }

  getDeliveryLog(): Array<{ payload: NotificationPayload; recipient: string; timestamp: Date }> {
    return [...this.deliveryLog];
  }

  clearDeliveryLog(): void {
    this.deliveryLog = [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class MockInAppChannel implements NotificationChannel {
  readonly type: DeliveryChannel = 'in_app';
  private deliveryDelay: number;
  private failureRate: number;
  private deliveryLog: Array<{ payload: NotificationPayload; recipient: string; timestamp: Date }> = [];

  constructor(config: { deliveryDelay?: number; failureRate?: number } = {}) {
    this.deliveryDelay = config.deliveryDelay || 10; // Fast for in-app
    this.failureRate = config.failureRate || 0;
  }

  async send(payload: NotificationPayload, recipient: string): Promise<NotificationDeliveryResult> {
    await this.delay(this.deliveryDelay);
    
    this.deliveryLog.push({ payload, recipient, timestamp: new Date() });

    if (Math.random() < this.failureRate) {
      return {
        success: false,
        error: 'WebSocket connection lost'
      };
    }

    return {
      success: true,
      messageId: `inapp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  validateRecipient(recipient: string): boolean {
    // For in-app, recipient is typically a user ID
    return recipient.length > 0 && /^[a-zA-Z0-9_-]+$/.test(recipient);
  }

  getSupportedFeatures(): ChannelFeatures {
    return {
      supportsRichText: true,
      supportsButtons: true,
      supportsImages: true,
      maxMessageLength: 10000,
      supportsBatching: true
    };
  }

  getDeliveryLog(): Array<{ payload: NotificationPayload; recipient: string; timestamp: Date }> {
    return [...this.deliveryLog];
  }

  clearDeliveryLog(): void {
    this.deliveryLog = [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class MockWebhookChannel implements NotificationChannel {
  readonly type: DeliveryChannel = 'webhook';
  private deliveryDelay: number;
  private failureRate: number;
  private deliveryLog: Array<{ payload: NotificationPayload; recipient: string; timestamp: Date }> = [];

  constructor(config: { deliveryDelay?: number; failureRate?: number } = {}) {
    this.deliveryDelay = config.deliveryDelay || 200; // Slower for external webhooks
    this.failureRate = config.failureRate || 0;
  }

  async send(payload: NotificationPayload, recipient: string): Promise<NotificationDeliveryResult> {
    await this.delay(this.deliveryDelay);
    
    this.deliveryLog.push({ payload, recipient, timestamp: new Date() });

    if (Math.random() < this.failureRate) {
      const errors = [
        'Connection timeout',
        'Invalid webhook URL',
        'Webhook returned 404',
        'Webhook returned 500',
        'SSL certificate verification failed'
      ];
      return {
        success: false,
        error: errors[Math.floor(Math.random() * errors.length)]
      };
    }

    if (!this.validateRecipient(recipient)) {
      return {
        success: false,
        error: 'Invalid webhook URL format'
      };
    }

    return {
      success: true,
      messageId: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  validateRecipient(recipient: string): boolean {
    try {
      const url = new URL(recipient);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  }

  getSupportedFeatures(): ChannelFeatures {
    return {
      supportsRichText: false,
      supportsButtons: false,
      supportsImages: false,
      maxMessageLength: 50000,
      supportsBatching: true
    };
  }

  getDeliveryLog(): Array<{ payload: NotificationPayload; recipient: string; timestamp: Date }> {
    return [...this.deliveryLog];
  }

  clearDeliveryLog(): void {
    this.deliveryLog = [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function for creating channels with different behaviors
export function createMockChannels(config: {
  emailFailureRate?: number;
  slackFailureRate?: number;
  teamsFailureRate?: number;
  webhookFailureRate?: number;
  deliveryDelays?: Partial<Record<DeliveryChannel, number>>;
} = {}): NotificationChannel[] {
  return [
    new MockEmailChannel({ 
      failureRate: config.emailFailureRate || 0,
      deliveryDelay: config.deliveryDelays?.email
    }),
    new MockSlackChannel({ 
      failureRate: config.slackFailureRate || 0,
      deliveryDelay: config.deliveryDelays?.slack
    }),
    new MockTeamsChannel({ 
      failureRate: config.teamsFailureRate || 0,
      deliveryDelay: config.deliveryDelays?.teams
    }),
    new MockInAppChannel({ 
      failureRate: 0, // In-app should be most reliable
      deliveryDelay: config.deliveryDelays?.in_app
    }),
    new MockWebhookChannel({ 
      failureRate: config.webhookFailureRate || 0,
      deliveryDelay: config.deliveryDelays?.webhook
    })
  ];
}