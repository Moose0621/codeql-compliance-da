// Mock Slack Service for E2E Testing
import type { MockSlackDelivery, NotificationEvent } from '@/types/notifications';

export class MockSlackService {
  private deliveries: MockSlackDelivery[] = [];
  private failureRate: number = 0;
  private deliveryDelay: number = 150; // ms
  private rateLimitDelay: number = 0;

  constructor(options: {
    failureRate?: number;
    deliveryDelay?: number;
    rateLimitDelay?: number;
  } = {}) {
    this.failureRate = options.failureRate || 0;
    this.deliveryDelay = options.deliveryDelay || 150;
    this.rateLimitDelay = options.rateLimitDelay || 0;
  }

  async sendMessage(
    channel: string,
    text: string,
    username: string = 'CodeQL Bot',
    attachments: any[] = []
  ): Promise<MockSlackDelivery> {
    // Simulate rate limiting
    if (this.rateLimitDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, this.deliveryDelay));

    const shouldFail = Math.random() < this.failureRate;
    
    const delivery: MockSlackDelivery = {
      channel,
      username,
      text,
      attachments,
      delivered: !shouldFail,
      error: shouldFail ? 'Simulated Slack API failure' : undefined
    };

    this.deliveries.push(delivery);
    return delivery;
  }

  async sendNotificationMessage(event: NotificationEvent, channel: string): Promise<MockSlackDelivery> {
    const text = this.formatSlackMessage(event);
    const attachments = this.createSlackAttachments(event);
    
    return this.sendMessage(channel, text, 'Security Bot', attachments);
  }

  private formatSlackMessage(event: NotificationEvent): string {
    const severityEmoji = this.getSeverityEmoji(event.severity);
    return `${severityEmoji} *${event.title}*\n${event.message}`;
  }

  private createSlackAttachments(event: NotificationEvent): any[] {
    const attachments: any[] = [];

    // Main notification attachment
    const mainAttachment: any = {
      color: this.getSeverityColor(event.severity),
      fields: [
        {
          title: 'Severity',
          value: event.severity.toUpperCase(),
          short: true
        },
        {
          title: 'Type',
          value: this.formatNotificationType(event.type),
          short: true
        },
        {
          title: 'Timestamp',
          value: `<!date^${Math.floor(Date.parse(event.timestamp) / 1000)}^{date_num} {time_secs}|${event.timestamp}>`,
          short: true
        }
      ],
      footer: 'CodeQL Security Dashboard',
      ts: Math.floor(Date.parse(event.timestamp) / 1000)
    };

    // Add repository information if available
    if (event.context.repository) {
      mainAttachment.fields.push({
        title: 'Repository',
        value: `<${event.context.repository.url}|${event.context.repository.name}>`,
        short: true
      });
      mainAttachment.fields.push({
        title: 'Owner',
        value: event.context.repository.owner,
        short: true
      });
    }

    attachments.push(mainAttachment);

    // Add security finding details if available
    if (event.context.security_finding) {
      attachments.push({
        color: '#dc2626',
        title: '🔍 Security Finding Details',
        fields: [
          {
            title: 'Rule ID',
            value: event.context.security_finding.rule_id,
            short: true
          },
          {
            title: 'File',
            value: event.context.security_finding.file_path,
            short: true
          }
        ]
      });

      if (event.context.security_finding.line_number) {
        attachments[attachments.length - 1].fields.push({
          title: 'Line Number',
          value: event.context.security_finding.line_number.toString(),
          short: true
        });
      }
    }

    // Add workflow information if available
    if (event.context.workflow) {
      attachments.push({
        color: '#ea580c',
        title: '⚙️ Workflow Information',
        fields: [
          {
            title: 'Workflow',
            value: event.context.workflow.name,
            short: true
          },
          {
            title: 'Run',
            value: `<${event.context.workflow.run_url}|#${event.context.workflow.run_id}>`,
            short: true
          }
        ]
      });

      if (event.context.workflow.failure_reason) {
        attachments[attachments.length - 1].fields.push({
          title: 'Failure Reason',
          value: event.context.workflow.failure_reason,
          short: false
        });
      }
    }

    // Add compliance issue details if available
    if (event.context.compliance_issue) {
      const complianceAttachment: any = {
        color: '#d97706',
        title: '📋 Compliance Issue Details',
        fields: [
          {
            title: 'Policy',
            value: event.context.compliance_issue.policy_name,
            short: true
          },
          {
            title: 'Violation Type',
            value: event.context.compliance_issue.violation_type,
            short: true
          }
        ]
      };

      if (event.context.compliance_issue.remediation_steps.length > 0) {
        complianceAttachment.fields.push({
          title: 'Remediation Steps',
          value: event.context.compliance_issue.remediation_steps.map(step => `• ${step}`).join('\n'),
          short: false
        });
      }

      attachments.push(complianceAttachment);
    }

    return attachments;
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return '💡';
      default: return 'ℹ️';
    }
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return '#d97706';
      case 'low': return 'good';
      default: return '#6b7280';
    }
  }

  private formatNotificationType(type: string): string {
    return type.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  getDeliveries(): MockSlackDelivery[] {
    return [...this.deliveries];
  }

  clearDeliveries(): void {
    this.deliveries = [];
  }

  getDeliveryCount(): number {
    return this.deliveries.length;
  }

  getSuccessfulDeliveries(): MockSlackDelivery[] {
    return this.deliveries.filter(d => d.delivered);
  }

  getFailedDeliveries(): MockSlackDelivery[] {
    return this.deliveries.filter(d => !d.delivered);
  }

  simulateRateLimiting(delayMs: number): void {
    this.rateLimitDelay = delayMs;
  }

  removeRateLimiting(): void {
    this.rateLimitDelay = 0;
  }
}