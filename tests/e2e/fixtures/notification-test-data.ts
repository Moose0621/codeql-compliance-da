// Test Data Management for Notification System E2E Tests
import type {
  NotificationEvent,
  NotificationPreferences,
  NotificationTestScenario,
  EscalationRule,
  DigestSettings,
  NotificationContext
} from '@/types/notifications';

export class NotificationTestDataManager {
  private static readonly TEST_REPOSITORIES = [
    'test-org/security-repo',
    'test-org/compliance-repo',
    'test-org/workflow-repo',
    'test-org/archived-repo',
    'test-org/vulnerable-repo',
    'test-org/non-compliant-repo',
    'test-org/failing-repo'
  ];

  private static readonly TEST_USERS = [
    'test-user',
    'admin-user',
    'security-lead',
    'dev-user',
    'compliance-officer'
  ];

  // ===== Notification Event Factories =====

  static createSecurityAlert(
    severity: 'critical' | 'high' | 'medium' | 'low' = 'high',
    repository: string = 'test-org/security-repo',
    customContext?: Partial<NotificationContext>
  ): NotificationEvent {
    return {
      id: `security-alert-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      type: 'security_alert',
      severity,
      title: `Security Vulnerability Detected - ${severity.toUpperCase()}`,
      message: `A ${severity} severity vulnerability has been detected in ${repository}. Immediate attention required for security compliance.`,
      context: {
        repository: {
          name: repository.split('/')[1],
          url: `https://github.com/${repository}`,
          owner: repository.split('/')[0]
        },
        security_finding: {
          rule_id: this.getRandomRuleId(),
          severity,
          file_path: this.getRandomFilePath(),
          line_number: Math.floor(Math.random() * 200) + 1
        },
        ...customContext
      },
      timestamp: new Date().toISOString(),
      repository,
      user_id: 'test-user'
    };
  }

  static createComplianceViolation(
    repository: string = 'test-org/compliance-repo',
    policyName: string = 'FedRAMP Scanning Policy'
  ): NotificationEvent {
    const violations = [
      'Missing required scan within 30 days',
      'CodeQL workflow not configured',
      'Insufficient scan coverage',
      'Security findings not addressed within SLA',
      'Missing vulnerability assessment documentation'
    ];

    const remediationSteps = [
      'Enable CodeQL workflow in the repository',
      'Configure workflow_dispatch trigger for on-demand scanning',
      'Run initial comprehensive security scan',
      'Set up automated scanning schedule (daily/weekly)',
      'Document scan results and remediation actions',
      'Update compliance tracking dashboard'
    ];

    return {
      id: `compliance-violation-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      type: 'compliance_violation',
      severity: 'medium',
      title: `${policyName} Violation`,
      message: `Repository ${repository} violates ${policyName} requirements. Immediate remediation required to maintain compliance status.`,
      context: {
        repository: {
          name: repository.split('/')[1],
          url: `https://github.com/${repository}`,
          owner: repository.split('/')[0]
        },
        compliance_issue: {
          policy_name: policyName,
          violation_type: violations[Math.floor(Math.random() * violations.length)],
          remediation_steps: remediationSteps.slice(0, Math.floor(Math.random() * 4) + 3)
        }
      },
      timestamp: new Date().toISOString(),
      repository,
      user_id: 'compliance-officer'
    };
  }

  static createWorkflowFailure(
    repository: string = 'test-org/workflow-repo',
    workflowName: string = 'CodeQL Analysis'
  ): NotificationEvent {
    const failureReasons = [
      'Build failed: compilation errors detected',
      'CodeQL analysis timeout after 60 minutes',
      'Out of memory error during analysis',
      'Authentication failed: GitHub token expired',
      'Missing required permissions for security_events',
      'Database initialization failed',
      'Network timeout during artifact upload'
    ];

    const runId = Math.floor(Math.random() * 90000000) + 10000000;

    return {
      id: `workflow-failure-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      type: 'workflow_failure',
      severity: 'high',
      title: `${workflowName} Workflow Failed`,
      message: `The ${workflowName} workflow has failed for ${repository}. This may impact security scanning coverage and compliance reporting.`,
      context: {
        repository: {
          name: repository.split('/')[1],
          url: `https://github.com/${repository}`,
          owner: repository.split('/')[0]
        },
        workflow: {
          name: workflowName,
          run_id: runId,
          run_url: `https://github.com/${repository}/actions/runs/${runId}`,
          failure_reason: failureReasons[Math.floor(Math.random() * failureReasons.length)]
        }
      },
      timestamp: new Date().toISOString(),
      repository,
      user_id: 'dev-user'
    };
  }

  static createRepositoryStatusChange(
    repository: string = 'test-org/status-repo',
    changeType: 'archived' | 'visibility_changed' | 'access_modified' = 'archived'
  ): NotificationEvent {
    const messages = {
      archived: `Repository ${repository} has been archived and is now read-only`,
      visibility_changed: `Repository ${repository} visibility has been changed`,
      access_modified: `Access permissions for ${repository} have been modified`
    };

    return {
      id: `status-change-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      type: 'repository_status_change',
      severity: 'info',
      title: `Repository Status Changed`,
      message: messages[changeType],
      context: {
        repository: {
          name: repository.split('/')[1],
          url: `https://github.com/${repository}`,
          owner: repository.split('/')[0]
        }
      },
      timestamp: new Date().toISOString(),
      repository,
      user_id: 'admin-user'
    };
  }

  static createDigestNotification(
    repositories: string[] = this.TEST_REPOSITORIES.slice(0, 3),
    timeframe: '24h' | '7d' = '24h'
  ): NotificationEvent {
    const totalFindings = Math.floor(Math.random() * 20) + 5;
    const criticalFindings = Math.floor(totalFindings * 0.1);
    const highFindings = Math.floor(totalFindings * 0.3);
    
    return {
      id: `digest-${timeframe}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      type: 'scheduled_digest',
      severity: 'info',
      title: `Security Digest - Last ${timeframe === '24h' ? '24 Hours' : '7 Days'}`,
      message: `Security summary for ${repositories.length} repositories. Total findings: ${totalFindings} (${criticalFindings} critical, ${highFindings} high severity)`,
      context: {},
      timestamp: new Date().toISOString(),
      user_id: 'test-user'
    };
  }

  // ===== Preference Configuration Factories =====

  static createDefaultPreferences(userId: string = 'test-user'): NotificationPreferences {
    return {
      user_id: userId,
      channels: [
        {
          id: 'email-1',
          name: 'email',
          enabled: true,
          config: {
            email: {
              addresses: [`${userId}@example.com`],
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
              webhook_url: 'https://hooks.slack.com/services/TEST/WEBHOOK/URL',
              channel: '#security-alerts',
              username: 'SecurityBot'
            }
          }
        },
        {
          id: 'teams-1',
          name: 'teams',
          enabled: true,
          config: {
            teams: {
              webhook_url: 'https://outlook.office.com/webhook/test-webhook-url',
              channel: 'Security Team'
            }
          }
        },
        {
          id: 'in-app-1',
          name: 'in-app',
          enabled: true,
          config: {
            'in-app': {
              toast_enabled: true,
              notification_center_enabled: true
            }
          }
        }
      ],
      frequency: 'immediate',
      content_filters: {
        notification_types: ['security_alert', 'workflow_failure', 'compliance_violation', 'repository_status_change'],
        severity_levels: ['critical', 'high', 'medium', 'low', 'info']
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

  static createRestrictivePreferences(userId: string = 'test-user'): NotificationPreferences {
    return {
      user_id: userId,
      channels: [
        {
          id: 'email-1',
          name: 'email',
          enabled: true,
          config: {
            email: {
              addresses: [`${userId}@example.com`],
              format: 'html'
            }
          }
        }
      ],
      frequency: 'digest_only',
      content_filters: {
        notification_types: ['security_alert'],
        severity_levels: ['critical']
      },
      quiet_hours: {
        enabled: true,
        start_time: '18:00',
        end_time: '09:00',
        timezone: 'UTC'
      },
      emergency_override: false
    };
  }

  static createBatchedPreferences(userId: string = 'test-user'): NotificationPreferences {
    return {
      user_id: userId,
      channels: [
        {
          id: 'email-1',
          name: 'email',
          enabled: true,
          config: {
            email: {
              addresses: [`${userId}@example.com`],
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
              webhook_url: 'https://hooks.slack.com/services/TEST/WEBHOOK/URL',
              channel: '#security-batched'
            }
          }
        }
      ],
      frequency: 'batched',
      content_filters: {
        notification_types: ['security_alert', 'compliance_violation'],
        severity_levels: ['critical', 'high', 'medium']
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

  // ===== Test Scenario Generators =====

  static createTestScenarios(): NotificationTestScenario[] {
    return [
      {
        id: 'critical-security-immediate',
        name: 'Critical Security Alert - Immediate Delivery',
        description: 'Tests immediate multi-channel delivery of critical security alerts',
        trigger_event: this.createSecurityAlert('critical'),
        expected_channels: ['email', 'slack', 'teams', 'in-app'],
        expected_delivery_time_ms: 5000,
        escalation_expected: false
      },
      {
        id: 'high-security-with-escalation',
        name: 'High Security Alert - With Escalation',
        description: 'Tests escalation workflow for unaddressed high severity alerts',
        trigger_event: this.createSecurityAlert('high'),
        expected_channels: ['email', 'slack', 'teams'],
        expected_delivery_time_ms: 3000,
        escalation_expected: true
      },
      {
        id: 'compliance-violation-standard',
        name: 'Compliance Violation - Standard Process',
        description: 'Tests standard compliance violation notification flow',
        trigger_event: this.createComplianceViolation(),
        expected_channels: ['email', 'slack'],
        expected_delivery_time_ms: 4000,
        escalation_expected: false
      },
      {
        id: 'workflow-failure-dev-team',
        name: 'Workflow Failure - Development Team',
        description: 'Tests workflow failure notifications with technical context',
        trigger_event: this.createWorkflowFailure(),
        expected_channels: ['slack', 'teams'],
        expected_delivery_time_ms: 3000,
        escalation_expected: false
      },
      {
        id: 'repository-change-info',
        name: 'Repository Change - Informational',
        description: 'Tests low-priority informational notifications',
        trigger_event: this.createRepositoryStatusChange(),
        expected_channels: ['email'],
        expected_delivery_time_ms: 2000,
        escalation_expected: false
      },
      {
        id: 'quiet-hours-override',
        name: 'Emergency Override During Quiet Hours',
        description: 'Tests emergency notifications during configured quiet hours',
        trigger_event: this.createSecurityAlert('critical'),
        expected_channels: ['email', 'slack'],
        expected_delivery_time_ms: 5000,
        escalation_expected: false,
        test_preferences: {
          ...this.createDefaultPreferences(),
          quiet_hours: {
            enabled: true,
            start_time: '00:00',
            end_time: '23:59',
            timezone: 'UTC'
          }
        }
      }
    ];
  }

  // ===== Edge Case and Error Scenario Generators =====

  static createMalformedNotificationEvent(): Partial<NotificationEvent> {
    return {
      id: 'malformed-event',
      type: 'security_alert',
      // Missing required fields intentionally
      timestamp: new Date().toISOString(),
      user_id: 'test-user'
    };
  }

  static createLargeNotificationEvent(): NotificationEvent {
    const largeMessage = 'A'.repeat(5000); // Very large message content
    const largeFindingContext = {
      repository: {
        name: 'large-repo',
        url: 'https://github.com/test-org/large-repo',
        owner: 'test-org'
      },
      security_finding: {
        rule_id: 'CWE-' + Math.floor(Math.random() * 1000),
        severity: 'high' as const,
        file_path: '/src/very/deep/nested/directory/structure/with/many/levels/file.tsx',
        line_number: 999999
      }
    };

    return {
      id: `large-event-${Date.now()}`,
      type: 'security_alert',
      severity: 'high',
      title: 'Large Notification Event Test',
      message: largeMessage,
      context: largeFindingContext,
      timestamp: new Date().toISOString(),
      repository: 'test-org/large-repo',
      user_id: 'test-user'
    };
  }

  // ===== Performance Test Data Generators =====

  static createHighVolumeEventBatch(count: number = 100): NotificationEvent[] {
    const events: NotificationEvent[] = [];
    const eventTypes = ['security_alert', 'workflow_failure', 'compliance_violation'] as const;
    const severities = ['critical', 'high', 'medium', 'low'] as const;

    for (let i = 0; i < count; i++) {
      const type = eventTypes[i % eventTypes.length];
      const severity = severities[i % severities.length];
      const repo = this.TEST_REPOSITORIES[i % this.TEST_REPOSITORIES.length];

      switch (type) {
        case 'security_alert':
          events.push(this.createSecurityAlert(severity, repo));
          break;
        case 'workflow_failure':
          events.push(this.createWorkflowFailure(repo));
          break;
        case 'compliance_violation':
          events.push(this.createComplianceViolation(repo));
          break;
      }
    }

    return events;
  }

  // ===== Helper Methods =====

  private static readonly COMMON_CWE_NUMBERS = [79, 89, 120, 200, 209, 269, 287, 311, 352, 362, 400, 502, 601, 611, 732, 798, 807, 862];

  private static getRandomRuleId(): string {
    return `CWE-${this.COMMON_CWE_NUMBERS[Math.floor(Math.random() * this.COMMON_CWE_NUMBERS.length)]}`;
  }

  private static getRandomFilePath(): string {
    const paths = [
      'src/components/UserInput.tsx',
      'src/utils/authentication.ts',
      'src/services/api-client.js',
      'src/hooks/useAuth.tsx',
      'src/pages/Dashboard.tsx',
      'src/lib/database.ts',
      'src/middleware/cors.js',
      'src/components/forms/LoginForm.tsx',
      'src/utils/validation.ts',
      'src/services/notification-service.ts'
    ];
    return paths[Math.floor(Math.random() * paths.length)];
  }

  static getTestRepositories(): string[] {
    return [...this.TEST_REPOSITORIES];
  }

  static getTestUsers(): string[] {
    return [...this.TEST_USERS];
  }

  // ===== Digest Settings Factory =====

  static createDigestSettings(
    frequency: 'daily' | 'weekly' = 'daily',
    enabled: boolean = true
  ): DigestSettings {
    return {
      enabled,
      frequency,
      delivery_time: '09:00',
      timezone: 'UTC',
      include_summary_stats: true,
      include_resolved_items: false,
      max_items_per_digest: 50
    };
  }

  // ===== Escalation Rules Factory =====

  static createEscalationRules(): EscalationRule[] {
    return [
      {
        id: 'critical-immediate',
        name: 'Critical Alert Escalation',
        trigger: {
          notification_types: ['security_alert'],
          severity_levels: ['critical'],
          time_threshold_minutes: 15
        },
        escalation_channels: ['email', 'slack'],
        enabled: true
      },
      {
        id: 'high-workflow-failure',
        name: 'Workflow Failure Escalation',
        trigger: {
          notification_types: ['workflow_failure'],
          severity_levels: ['high', 'critical'],
          time_threshold_minutes: 30
        },
        escalation_channels: ['slack', 'teams'],
        enabled: true
      },
      {
        id: 'compliance-escalation',
        name: 'Compliance Issue Escalation',
        trigger: {
          notification_types: ['compliance_violation'],
          severity_levels: ['medium', 'high', 'critical'],
          time_threshold_minutes: 60
        },
        escalation_channels: ['email'],
        enabled: true
      }
    ];
  }
}