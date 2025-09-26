// Notification Test Suite for E2E Testing
import type { Page } from '@playwright/test';
import type {
  NotificationEvent,
  NotificationPreferences,
  NotificationTestScenario,
  EscalationRule,
  DigestSettings
} from '@/types/notifications';
import { MockEmailService } from './mock-email-service';
import { MockSlackService } from './mock-slack-service';
import { MockTeamsService } from './mock-teams-service';

export class NotificationTestSuite {
  private emailService: MockEmailService;
  private slackService: MockSlackService;
  private teamsService: MockTeamsService;
  private page: Page;

  constructor(page: Page, options: {
    emailFailureRate?: number;
    slackFailureRate?: number;
    teamsFailureRate?: number;
    deliveryDelay?: number;
  } = {}) {
    this.page = page;
    this.emailService = new MockEmailService({
      failureRate: options.emailFailureRate || 0,
      deliveryDelay: options.deliveryDelay || 100
    });
    this.slackService = new MockSlackService({
      failureRate: options.slackFailureRate || 0,
      deliveryDelay: options.deliveryDelay || 150
    });
    this.teamsService = new MockTeamsService({
      failureRate: options.teamsFailureRate || 0,
      deliveryDelay: options.deliveryDelay || 200
    });
  }

  async simulateSecurityAlert(
    severity: 'critical' | 'high' | 'medium' | 'low' = 'high',
    repository = 'test-org/security-repo'
  ): Promise<NotificationEvent> {
    const event: NotificationEvent = {
      id: `security-alert-${Date.now()}`,
      type: 'security_alert',
      severity,
      title: 'Security Vulnerability Detected',
      message: `A ${severity} severity vulnerability has been found in ${repository}`,
      context: {
        repository: {
          name: repository.split('/')[1],
          url: `https://github.com/${repository}`,
          owner: repository.split('/')[0]
        },
        security_finding: {
          rule_id: 'CWE-79',
          severity,
          file_path: 'src/components/UserInput.tsx',
          line_number: 42
        }
      },
      timestamp: new Date().toISOString(),
      repository,
      user_id: 'test-user'
    };

    await this.triggerNotificationEvent(event);
    return event;
  }

  async simulateWorkflowFailure(repository = 'test-org/workflow-repo'): Promise<NotificationEvent> {
    const event: NotificationEvent = {
      id: `workflow-failure-${Date.now()}`,
      type: 'workflow_failure',
      severity: 'high',
      title: 'CodeQL Workflow Failed',
      message: `The CodeQL analysis workflow has failed for ${repository}`,
      context: {
        repository: {
          name: repository.split('/')[1],
          url: `https://github.com/${repository}`,
          owner: repository.split('/')[0]
        },
        workflow: {
          name: 'CodeQL Analysis',
          run_id: 12345678,
          run_url: `https://github.com/${repository}/actions/runs/12345678`,
          failure_reason: 'Build failed: compilation errors detected'
        }
      },
      timestamp: new Date().toISOString(),
      repository,
      user_id: 'test-user'
    };

    await this.triggerNotificationEvent(event);
    return event;
  }

  async simulateComplianceViolation(repository = 'test-org/compliance-repo'): Promise<NotificationEvent> {
    const event: NotificationEvent = {
      id: `compliance-violation-${Date.now()}`,
      type: 'compliance_violation',
      severity: 'medium',
      title: 'FedRAMP Compliance Violation',
      message: `Repository ${repository} violates FedRAMP scanning requirements`,
      context: {
        repository: {
          name: repository.split('/')[1],
          url: `https://github.com/${repository}`,
          owner: repository.split('/')[0]
        },
        compliance_issue: {
          policy_name: 'FedRAMP Scanning Policy',
          violation_type: 'Missing required scan within 30 days',
          remediation_steps: [
            'Enable CodeQL workflow in the repository',
            'Configure workflow_dispatch trigger',
            'Run initial security scan',
            'Set up automated scanning schedule'
          ]
        }
      },
      timestamp: new Date().toISOString(),
      repository,
      user_id: 'test-user'
    };

    await this.triggerNotificationEvent(event);
    return event;
  }

  async simulateRepositoryStatusChange(repository = 'test-org/status-repo'): Promise<NotificationEvent> {
    const event: NotificationEvent = {
      id: `status-change-${Date.now()}`,
      type: 'repository_status_change',
      severity: 'info',
      title: 'Repository Archive Status Changed',
      message: `Repository ${repository} has been archived`,
      context: {
        repository: {
          name: repository.split('/')[1],
          url: `https://github.com/${repository}`,
          owner: repository.split('/')[0]
        }
      },
      timestamp: new Date().toISOString(),
      repository,
      user_id: 'test-user'
    };

    await this.triggerNotificationEvent(event);
    return event;
  }

  async triggerNotificationEvent(event: NotificationEvent): Promise<void> {
    // Simulate the notification system processing the event
    // In a real implementation, this would trigger the actual notification system
    
    // Mock the API route that would handle notification events
    await this.page.route('**/api/notifications/trigger', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          event_id: event.id,
          status: 'processed',
          channels_triggered: ['email', 'slack', 'teams'],
          timestamp: new Date().toISOString()
        })
      });
    });

    // Trigger delivery to mock services based on current preferences
    const preferences = await this.getCurrentPreferences();
    await this.deliverToChannels(event, preferences);
  }

  async verifyMultiChannelDelivery(channels: string[], expectedCount: number = 1): Promise<boolean> {
    let allDelivered = true;

    for (const channel of channels) {
      let deliveredCount = 0;
      
      switch (channel) {
        case 'email':
          deliveredCount = this.emailService.getSuccessfulDeliveries().length;
          break;
        case 'slack':
          deliveredCount = this.slackService.getSuccessfulDeliveries().length;
          break;
        case 'teams':
          deliveredCount = this.teamsService.getSuccessfulDeliveries().length;
          break;
      }

      if (deliveredCount < expectedCount) {
        console.warn(`Channel ${channel} delivered ${deliveredCount} messages, expected ${expectedCount}`);
        allDelivered = false;
      }
    }

    return allDelivered;
  }

  async validateNotificationContent(
    channel: string,
    expectedContent: {
      subject?: string;
      contains?: string[];
      severity?: string;
    }
  ): Promise<void> {
    let deliveries: any[] = [];
    
    switch (channel) {
      case 'email':
        deliveries = this.emailService.getSuccessfulDeliveries();
        break;
      case 'slack':
        deliveries = this.slackService.getSuccessfulDeliveries();
        break;
      case 'teams':
        deliveries = this.teamsService.getSuccessfulDeliveries();
        break;
    }

    if (deliveries.length === 0) {
      throw new Error(`No deliveries found for channel: ${channel}`);
    }

    const latestDelivery = deliveries[deliveries.length - 1];

    // Validate subject/title if provided
    if (expectedContent.subject) {
      const actualSubject = channel === 'email' ? latestDelivery.subject : latestDelivery.text;
      if (!actualSubject.includes(expectedContent.subject)) {
        throw new Error(`Subject/title does not contain "${expectedContent.subject}". Got: ${actualSubject}`);
      }
    }

    // Validate content contains expected strings
    if (expectedContent.contains) {
      let contentToCheck = '';
      switch (channel) {
        case 'email':
          contentToCheck = latestDelivery.html_body + ' ' + latestDelivery.text_body;
          break;
        case 'slack':
          contentToCheck = latestDelivery.text + ' ' + JSON.stringify(latestDelivery.attachments);
          break;
        case 'teams':
          contentToCheck = JSON.stringify(latestDelivery.card_content);
          break;
      }

      for (const expectedText of expectedContent.contains) {
        if (!contentToCheck.includes(expectedText)) {
          throw new Error(`Content does not contain "${expectedText}" in channel ${channel}`);
        }
      }
    }

    // Validate severity if provided
    if (expectedContent.severity) {
      let contentToCheck = '';
      switch (channel) {
        case 'email':
          contentToCheck = latestDelivery.subject + ' ' + latestDelivery.html_body;
          break;
        case 'slack':
        case 'teams':
          contentToCheck = JSON.stringify(latestDelivery);
          break;
      }

      if (!contentToCheck.toLowerCase().includes(expectedContent.severity.toLowerCase())) {
        throw new Error(`Content does not indicate severity "${expectedContent.severity}" in channel ${channel}`);
      }
    }
  }

  async testEscalationWorkflow(scenario: {
    initialEvent: NotificationEvent;
    escalationDelayMs: number;
    escalationChannels: string[];
  }): Promise<void> {
    // Trigger initial event
    await this.triggerNotificationEvent(scenario.initialEvent);

    // Wait for escalation delay
    await new Promise(resolve => setTimeout(resolve, scenario.escalationDelayMs));

    // Simulate escalation trigger
    for (const channel of scenario.escalationChannels) {
      const escalationEvent: NotificationEvent = {
        ...scenario.initialEvent,
        id: `escalation-${scenario.initialEvent.id}`,
        title: `[ESCALATED] ${scenario.initialEvent.title}`,
        message: `ESCALATION: ${scenario.initialEvent.message}`
      };

      await this.deliverToChannels(escalationEvent, await this.getCurrentPreferences());
    }
  }

  private async deliverToChannels(event: NotificationEvent, preferences: NotificationPreferences): Promise<void> {
    for (const channel of preferences.channels) {
      if (!channel.enabled) continue;

      switch (channel.name) {
        case 'email':
          if (channel.config.email?.addresses.length) {
            await this.emailService.sendNotificationEmail(event, channel.config.email.addresses);
          }
          break;
        case 'slack':
          if (channel.config.slack?.channel) {
            await this.slackService.sendNotificationMessage(event, channel.config.slack.channel);
          }
          break;
        case 'teams':
          if (channel.config.teams?.webhook_url) {
            await this.teamsService.sendNotificationCard(event, channel.config.teams.webhook_url);
          }
          break;
      }
    }
  }

  private async getCurrentPreferences(): Promise<NotificationPreferences> {
    // Default preferences for testing
    return {
      user_id: 'test-user',
      channels: [
        {
          id: 'email-1',
          name: 'email',
          enabled: true,
          config: {
            email: {
              addresses: ['test@example.com'],
              format: 'both'
            }
          }
        },
        {
          id: 'slack-1',
          name: 'slack',
          enabled: true,
          config: {
            slack: {
              webhook_url: 'https://hooks.slack.com/test',
              channel: '#security-alerts'
            }
          }
        },
        {
          id: 'teams-1',
          name: 'teams',
          enabled: true,
          config: {
            teams: {
              webhook_url: 'https://outlook.office.com/webhook/test',
              channel: 'Security Team'
            }
          }
        }
      ],
      frequency: 'immediate',
      content_filters: {
        notification_types: ['security_alert', 'workflow_failure', 'compliance_violation'],
        severity_levels: ['critical', 'high', 'medium', 'low']
      },
      quiet_hours: {
        enabled: false,
        start_time: '22:00',
        end_time: '08:00',
        timezone: 'UTC'
      },
      emergency_override: true
    };
  }

  // Utility methods for test data management
  clearAllDeliveries(): void {
    this.emailService.clearDeliveries();
    this.slackService.clearDeliveries();
    this.teamsService.clearDeliveries();
  }

  getDeliveryStats(): {
    email: { total: number; successful: number; failed: number };
    slack: { total: number; successful: number; failed: number };
    teams: { total: number; successful: number; failed: number };
  } {
    return {
      email: {
        total: this.emailService.getDeliveryCount(),
        successful: this.emailService.getSuccessfulDeliveries().length,
        failed: this.emailService.getFailedDeliveries().length
      },
      slack: {
        total: this.slackService.getDeliveryCount(),
        successful: this.slackService.getSuccessfulDeliveries().length,
        failed: this.slackService.getFailedDeliveries().length
      },
      teams: {
        total: this.teamsService.getDeliveryCount(),
        successful: this.teamsService.getSuccessfulDeliveries().length,
        failed: this.teamsService.getFailedDeliveries().length
      }
    };
  }

  // Service getters for advanced testing scenarios
  getEmailService(): MockEmailService {
    return this.emailService;
  }

  getSlackService(): MockSlackService {
    return this.slackService;
  }

  getTeamsService(): MockTeamsService {
    return this.teamsService;
  }
}