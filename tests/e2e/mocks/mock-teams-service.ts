// Mock Microsoft Teams Service for E2E Testing
import type { MockTeamsDelivery, NotificationEvent } from '@/types/notifications';

export class MockTeamsService {
  private deliveries: MockTeamsDelivery[] = [];
  private failureRate: number = 0;
  private deliveryDelay: number = 200; // ms

  constructor(options: {
    failureRate?: number;
    deliveryDelay?: number;
  } = {}) {
    this.failureRate = options.failureRate || 0;
    this.deliveryDelay = options.deliveryDelay || 200;
  }

  async sendAdaptiveCard(
    webhookUrl: string,
    cardContent: any
  ): Promise<MockTeamsDelivery> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, this.deliveryDelay));

    const shouldFail = Math.random() < this.failureRate;
    
    const delivery: MockTeamsDelivery = {
      webhook_url: webhookUrl,
      card_content: cardContent,
      delivered: !shouldFail,
      error: shouldFail ? 'Simulated Teams webhook failure' : undefined
    };

    this.deliveries.push(delivery);
    return delivery;
  }

  async sendNotificationCard(event: NotificationEvent, webhookUrl: string): Promise<MockTeamsDelivery> {
    const cardContent = this.createAdaptiveCard(event);
    return this.sendAdaptiveCard(webhookUrl, cardContent);
  }

  private createAdaptiveCard(event: NotificationEvent): any {
    const card = {
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          version: '1.6',
          body: [
            {
              type: 'Container',
              style: this.getSeverityStyle(event.severity),
              items: [
                {
                  type: 'TextBlock',
                  text: `${this.getSeverityEmoji(event.severity)} ${event.title}`,
                  weight: 'Bolder',
                  size: 'Large',
                  color: 'Light'
                },
                {
                  type: 'TextBlock',
                  text: event.message,
                  wrap: true,
                  color: 'Light'
                }
              ]
            },
            {
              type: 'FactSet',
              facts: this.createFactSet(event)
            }
          ]
        }
      }]
    };

    // Add repository information section if available
    if (event.context.repository) {
      card.attachments[0].content.body.push({
        type: 'Container',
        style: 'emphasis',
        items: [
          {
            type: 'TextBlock',
            text: '📁 Repository Information',
            weight: 'Bolder',
            size: 'Medium'
          },
          {
            type: 'FactSet',
            facts: [
              {
                title: 'Repository',
                value: event.context.repository.name
              },
              {
                title: 'Owner',
                value: event.context.repository.owner
              }
            ]
          }
        ]
      });

      // Add action button to view repository
      if (!card.attachments[0].content.actions) {
        card.attachments[0].content.actions = [];
      }
      card.attachments[0].content.actions.push({
        type: 'Action.OpenUrl',
        title: 'View Repository',
        url: event.context.repository.url
      });
    }

    // Add security finding details if available
    if (event.context.security_finding) {
      card.attachments[0].content.body.push({
        type: 'Container',
        style: 'attention',
        items: [
          {
            type: 'TextBlock',
            text: '🔍 Security Finding Details',
            weight: 'Bolder',
            size: 'Medium'
          },
          {
            type: 'FactSet',
            facts: [
              {
                title: 'Rule ID',
                value: event.context.security_finding.rule_id
              },
              {
                title: 'File Path',
                value: event.context.security_finding.file_path
              },
              ...(event.context.security_finding.line_number ? [{
                title: 'Line Number',
                value: event.context.security_finding.line_number.toString()
              }] : [])
            ]
          }
        ]
      });
    }

    // Add workflow information if available
    if (event.context.workflow) {
      card.attachments[0].content.body.push({
        type: 'Container',
        style: 'warning',
        items: [
          {
            type: 'TextBlock',
            text: '⚙️ Workflow Information',
            weight: 'Bolder',
            size: 'Medium'
          },
          {
            type: 'FactSet',
            facts: [
              {
                title: 'Workflow Name',
                value: event.context.workflow.name
              },
              {
                title: 'Run ID',
                value: `#${event.context.workflow.run_id}`
              },
              ...(event.context.workflow.failure_reason ? [{
                title: 'Failure Reason',
                value: event.context.workflow.failure_reason
              }] : [])
            ]
          }
        ]
      });

      // Add action button to view workflow run
      if (!card.attachments[0].content.actions) {
        card.attachments[0].content.actions = [];
      }
      card.attachments[0].content.actions.push({
        type: 'Action.OpenUrl',
        title: 'View Workflow Run',
        url: event.context.workflow.run_url
      });
    }

    // Add compliance issue details if available
    if (event.context.compliance_issue) {
      const remediationSteps = event.context.compliance_issue.remediation_steps
        .map((step, index) => `${index + 1}. ${step}`)
        .join('\n\n');

      card.attachments[0].content.body.push({
        type: 'Container',
        style: 'good',
        items: [
          {
            type: 'TextBlock',
            text: '📋 Compliance Issue Details',
            weight: 'Bolder',
            size: 'Medium'
          },
          {
            type: 'FactSet',
            facts: [
              {
                title: 'Policy Name',
                value: event.context.compliance_issue.policy_name
              },
              {
                title: 'Violation Type',
                value: event.context.compliance_issue.violation_type
              }
            ]
          },
          ...(remediationSteps ? [{
            type: 'TextBlock',
            text: '**Remediation Steps:**',
            weight: 'Bolder'
          }, {
            type: 'TextBlock',
            text: remediationSteps,
            wrap: true
          }] : [])
        ]
      });
    }

    return card;
  }

  private createFactSet(event: NotificationEvent): any[] {
    return [
      {
        title: 'Severity',
        value: event.severity.toUpperCase()
      },
      {
        title: 'Type',
        value: this.formatNotificationType(event.type)
      },
      {
        title: 'Timestamp',
        value: new Date(event.timestamp).toLocaleString()
      },
      ...(event.repository ? [{
        title: 'Repository',
        value: event.repository
      }] : [])
    ];
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

  private getSeverityStyle(severity: string): string {
    switch (severity) {
      case 'critical': return 'attention';
      case 'high': return 'warning';
      case 'medium': return 'accent';
      case 'low': return 'good';
      default: return 'default';
    }
  }

  private formatNotificationType(type: string): string {
    return type.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  getDeliveries(): MockTeamsDelivery[] {
    return [...this.deliveries];
  }

  clearDeliveries(): void {
    this.deliveries = [];
  }

  getDeliveryCount(): number {
    return this.deliveries.length;
  }

  getSuccessfulDeliveries(): MockTeamsDelivery[] {
    return this.deliveries.filter(d => d.delivered);
  }

  getFailedDeliveries(): MockTeamsDelivery[] {
    return this.deliveries.filter(d => !d.delivered);
  }
}