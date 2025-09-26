// Notification System Types for E2E Testing

export interface NotificationChannel {
  id: string;
  name: 'email' | 'slack' | 'teams' | 'in-app' | 'mobile';
  enabled: boolean;
  config: NotificationChannelConfig;
}

export interface NotificationChannelConfig {
  email?: {
    addresses: string[];
    format: 'html' | 'text' | 'both';
  };
  slack?: {
    webhook_url: string;
    channel: string;
    username?: string;
  };
  teams?: {
    webhook_url: string;
    channel: string;
  };
  'in-app'?: {
    toast_enabled: boolean;
    notification_center_enabled: boolean;
  };
  mobile?: {
    push_enabled: boolean;
    device_tokens: string[];
  };
}

export interface NotificationPreferences {
  user_id: string;
  channels: NotificationChannel[];
  frequency: 'immediate' | 'batched' | 'digest_only';
  content_filters: {
    notification_types: NotificationType[];
    severity_levels: NotificationSeverity[];
  };
  quiet_hours: {
    enabled: boolean;
    start_time: string; // HH:MM format
    end_time: string;   // HH:MM format
    timezone: string;
  };
  emergency_override: boolean;
}

export type NotificationType = 
  | 'security_alert'
  | 'compliance_violation'
  | 'workflow_failure'
  | 'repository_status_change'
  | 'scheduled_digest';

export type NotificationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface NotificationEvent {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  context: NotificationContext;
  timestamp: string;
  repository?: string;
  user_id: string;
}

export interface NotificationContext {
  repository?: {
    name: string;
    url: string;
    owner: string;
  };
  security_finding?: {
    rule_id: string;
    severity: string;
    file_path: string;
    line_number?: number;
  };
  workflow?: {
    name: string;
    run_id: number;
    run_url: string;
    failure_reason?: string;
  };
  compliance_issue?: {
    policy_name: string;
    violation_type: string;
    remediation_steps: string[];
  };
}

export interface NotificationDelivery {
  id: string;
  notification_event_id: string;
  channel: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  delivery_time?: string;
  failure_reason?: string;
  retry_count: number;
  metadata?: Record<string, any>;
}

export interface EscalationRule {
  id: string;
  name: string;
  trigger: {
    notification_types: NotificationType[];
    severity_levels: NotificationSeverity[];
    time_threshold_minutes: number;
  };
  escalation_channels: string[];
  enabled: boolean;
}

export interface DigestSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  delivery_time: string; // HH:MM format
  timezone: string;
  include_summary_stats: boolean;
  include_resolved_items: boolean;
  max_items_per_digest: number;
}

export interface NotificationTestScenario {
  id: string;
  name: string;
  description: string;
  trigger_event: NotificationEvent;
  expected_channels: string[];
  expected_delivery_time_ms: number;
  escalation_expected: boolean;
  test_preferences?: NotificationPreferences;
}

// Mock service response types for E2E testing
export interface MockEmailDelivery {
  to: string[];
  subject: string;
  html_body: string;
  text_body: string;
  delivered: boolean;
  bounce_reason?: string;
}

export interface MockSlackDelivery {
  channel: string;
  username: string;
  text: string;
  attachments?: any[];
  delivered: boolean;
  error?: string;
}

export interface MockTeamsDelivery {
  webhook_url: string;
  card_content: any;
  delivered: boolean;
  error?: string;
}