import type {
  WorkflowRunWebhookEvent,
  CodeScanningAlertWebhookEvent,
  PushWebhookEvent,
  SecurityAdvisoryWebhookEvent,
  Repository,
  ScanRequest,
  RealTimeEvent,
  WebSocketMessage
} from '@/types/dashboard';

/**
 * Test data generators for realistic webhook integration testing
 * Provides factory functions for creating consistent test data
 */

export class WebhookTestDataGenerator {
  private static userCounter = 1;
  private static repoCounter = 1;
  private static workflowRunCounter = 10000;
  private static alertCounter = 1;

  /**
   * Generates realistic repository data for testing
   */
  static generateRepository(overrides: Partial<Repository> = {}): Repository {
    const id = this.repoCounter++;
    const name = `test-repo-${id}`;
    
    return {
      id,
      name,
      full_name: `test-org/${name}`,
      owner: {
        login: 'test-org',
        avatar_url: 'https://avatars.githubusercontent.com/u/123?v=4'
      },
      has_codeql_workflow: true,
      last_scan_date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_scan_status: this.randomChoice(['success', 'failure', 'in_progress', 'pending'] as const),
      security_findings: this.generateSecurityFindings(),
      workflow_dispatch_enabled: true,
      default_branch: 'main',
      languages: this.randomChoice([
        ['JavaScript', 'TypeScript'],
        ['Python'],
        ['Java', 'Kotlin'],
        ['C#'],
        ['Go'],
        ['Ruby'],
        ['PHP']
      ]),
      topics: this.randomChoice([
        ['security', 'codeql'],
        ['web-application'],
        ['microservice', 'api'],
        ['cli-tool'],
        ['library']
      ]),
      last_activity_date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      team_slug: this.randomChoice(['security-team', 'platform-team', 'frontend-team', 'backend-team']),
      compliance_score: Math.floor(Math.random() * 40) + 60, // 60-100
      ...overrides
    };
  }

  /**
   * Generates realistic workflow run webhook event
   */
  static generateWorkflowRunWebhook(overrides: Partial<WorkflowRunWebhookEvent> = {}): WorkflowRunWebhookEvent {
    const runId = this.workflowRunCounter++;
    const repository = this.generateRepository();
    const status = this.randomChoice(['queued', 'in_progress', 'completed'] as const);
    const conclusion = status === 'completed' 
      ? this.randomChoice(['success', 'failure', 'cancelled', 'skipped'] as const)
      : null;

    const baseTime = Date.now() - Math.random() * 24 * 60 * 60 * 1000;
    const createdAt = new Date(baseTime).toISOString();
    const updatedAt = new Date(baseTime + Math.random() * 30 * 60 * 1000).toISOString();

    return {
      action: status === 'completed' ? 'completed' : status === 'in_progress' ? 'in_progress' : 'requested',
      repository: {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        owner: repository.owner
      },
      sender: {
        login: this.randomChoice(['github-actions[bot]', 'developer-1', 'security-bot']),
        avatar_url: 'https://avatars.githubusercontent.com/u/456?v=4'
      },
      workflow_run: {
        id: runId,
        name: this.randomChoice(['CodeQL', 'Security Scan', 'SAST Analysis', 'Dependency Check']),
        status,
        conclusion,
        created_at: createdAt,
        updated_at: updatedAt,
        html_url: `https://github.com/${repository.full_name}/actions/runs/${runId}`,
        run_number: Math.floor(Math.random() * 500) + 1,
        workflow_id: Math.floor(Math.random() * 1000) + 1000,
        head_commit: {
          id: this.generateCommitSha(),
          message: this.generateCommitMessage(),
          author: {
            name: this.randomChoice(['Alice Smith', 'Bob Jones', 'Carol Brown', 'David Wilson']),
            email: this.randomChoice(['alice@company.com', 'bob@company.com', 'carol@company.com', 'david@company.com'])
          }
        }
      },
      ...overrides
    };
  }

  /**
   * Generates realistic code scanning alert webhook
   */
  static generateCodeScanningAlertWebhook(overrides: Partial<CodeScanningAlertWebhookEvent> = {}): CodeScanningAlertWebhookEvent {
    const alertId = this.alertCounter++;
    const repository = this.generateRepository();
    const severity = this.randomChoice(['error', 'warning', 'note'] as const);
    const securitySeverity = this.mapSeverityToSecurityLevel(severity);
    const action = this.randomChoice(['created', 'reopened', 'closed_by_user', 'fixed'] as const);

    return {
      action,
      repository: {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        owner: repository.owner
      },
      sender: {
        login: 'github-actions[bot]',
        avatar_url: 'https://avatars.githubusercontent.com/u/789?v=4'
      },
      alert: {
        number: alertId,
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        dismissed_at: action === 'closed_by_user' ? new Date().toISOString() : null,
        dismissed_by: action === 'closed_by_user' ? { login: 'security-admin' } : null,
        dismissed_reason: action === 'closed_by_user' 
          ? this.randomChoice(['false positive', 'won\'t fix', 'used in tests'])
          : null,
        rule: {
          id: this.generateRuleId(),
          severity,
          security_severity_level: securitySeverity,
          description: this.generateRuleDescription(severity)
        },
        state: action === 'created' || action === 'reopened' ? 'open' : 
               action === 'fixed' ? 'fixed' : 'dismissed'
      },
      ...overrides
    };
  }

  /**
   * Generates realistic push webhook event
   */
  static generatePushWebhook(overrides: Partial<PushWebhookEvent> = {}): PushWebhookEvent {
    const repository = this.generateRepository();
    const commitCount = Math.floor(Math.random() * 5) + 1;
    const commits = Array.from({ length: commitCount }, () => this.generateCommit());
    const headCommit = commits[commits.length - 1];

    return {
      action: 'pushed',
      repository: {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        owner: repository.owner
      },
      sender: {
        login: this.randomChoice(['developer-1', 'developer-2', 'external-contributor']),
        avatar_url: 'https://avatars.githubusercontent.com/u/101112?v=4'
      },
      ref: 'refs/heads/main',
      before: this.generateCommitSha(),
      after: headCommit.id,
      commits,
      head_commit: headCommit,
      ...overrides
    };
  }

  /**
   * Generates realistic security advisory webhook
   */
  static generateSecurityAdvisoryWebhook(overrides: Partial<SecurityAdvisoryWebhookEvent> = {}): SecurityAdvisoryWebhookEvent {
    const repository = this.generateRepository();
    const severity = this.randomChoice(['low', 'moderate', 'high', 'critical'] as const);
    const ecosystem = this.randomChoice(['npm', 'pip', 'maven', 'nuget', 'rubygems']);

    return {
      action: this.randomChoice(['published', 'updated', 'withdrawn']),
      repository: {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        owner: repository.owner
      },
      sender: {
        login: 'github-security',
        avatar_url: 'https://avatars.githubusercontent.com/u/213314?v=4'
      },
      security_advisory: {
        ghsa_id: `GHSA-${this.generateRandomString(4)}-${this.generateRandomString(4)}-${this.generateRandomString(4)}`,
        cve_id: `CVE-${new Date().getFullYear()}-${Math.floor(Math.random() * 99999).toString().padStart(5, '0')}`,
        summary: this.generateSecuritySummary(severity),
        description: this.generateSecurityDescription(severity),
        severity,
        published_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        withdrawn_at: null,
        vulnerabilities: [
          {
            package: {
              ecosystem,
              name: this.generatePackageName(ecosystem)
            },
            severity: severity.toUpperCase(),
            vulnerable_version_range: this.generateVersionRange(),
            first_patched_version: {
              identifier: this.generateVersion()
            }
          }
        ]
      },
      ...overrides
    };
  }

  /**
   * Generates realistic scan request data
   */
  static generateScanRequest(overrides: Partial<ScanRequest> = {}): ScanRequest {
    const repository = this.generateRepository();
    const baseTime = Date.now() - Math.random() * 24 * 60 * 60 * 1000;

    return {
      id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      repository: repository.full_name,
      timestamp: new Date(baseTime).toISOString(),
      status: this.randomChoice(['dispatched', 'running', 'completed', 'failed']),
      duration: Math.floor(Math.random() * 600) + 60, // 1-10 minutes
      findings: this.generateSecurityFindings(),
      ...overrides
    };
  }

  /**
   * Generates realistic real-time event
   */
  static generateRealTimeEvent(type?: RealTimeEvent['type'], overrides: Partial<RealTimeEvent> = {}): RealTimeEvent {
    const eventType = type || this.randomChoice(['repository_update', 'scan_status', 'security_alert', 'webhook_received']);
    
    let data: any;
    switch (eventType) {
      case 'repository_update':
        data = {
          repositoryId: Math.floor(Math.random() * 1000) + 1,
          updates: {
            last_scan_status: this.randomChoice(['success', 'failure', 'in_progress', 'pending']),
            security_findings: this.generateSecurityFindings()
          },
          timestamp: new Date().toISOString()
        };
        break;
      case 'scan_status':
        data = {
          repositoryName: `test-org/repo-${Math.floor(Math.random() * 100) + 1}`,
          scanId: `scan-${Date.now()}`,
          status: this.randomChoice(['completed', 'failed', 'running']),
          timestamp: new Date().toISOString(),
          findings: this.generateSecurityFindings(),
          duration: Math.floor(Math.random() * 600) + 60
        };
        break;
      case 'security_alert':
        data = {
          repository: `test-org/repo-${Math.floor(Math.random() * 100) + 1}`,
          severity: this.randomChoice(['critical', 'high', 'medium', 'low']),
          action: this.randomChoice(['created', 'closed'])
        };
        break;
      case 'webhook_received':
        data = {
          eventType: this.randomChoice(['workflow_run', 'code_scanning_alert', 'push']),
          payload: this.generateWorkflowRunWebhook()
        };
        break;
    }

    return {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      timestamp: new Date().toISOString(),
      data,
      source: this.randomChoice(['webhook', 'polling', 'user_action']),
      repository: data.repository || data.repositoryName,
      ...overrides
    };
  }

  /**
   * Generates realistic WebSocket message
   */
  static generateWebSocketMessage(type?: WebSocketMessage['type'], overrides: Partial<WebSocketMessage> = {}): WebSocketMessage {
    const messageType = type || this.randomChoice(['event', 'heartbeat', 'error']);
    
    let payload: any;
    switch (messageType) {
      case 'event':
        payload = this.generateRealTimeEvent();
        break;
      case 'heartbeat':
        payload = { status: 'pong', timestamp: Date.now() };
        break;
      case 'error':
        payload = { error: this.randomChoice(['Connection lost', 'Invalid message', 'Rate limited']) };
        break;
      case 'reconnect':
        payload = { reason: 'Server restart' };
        break;
    }

    return {
      type: messageType,
      payload,
      timestamp: new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Generates batch of test repositories
   */
  static generateRepositoryBatch(count: number): Repository[] {
    return Array.from({ length: count }, () => this.generateRepository());
  }

  /**
   * Generates mixed webhook event sequence
   */
  static generateWebhookSequence(count: number): RealTimeEvent[] {
    return Array.from({ length: count }, () => {
      const eventType = this.randomChoice(['workflow_run', 'code_scanning_alert', 'push', 'security_advisory']);
      let payload: any;
      
      switch (eventType) {
        case 'workflow_run':
          payload = this.generateWorkflowRunWebhook();
          break;
        case 'code_scanning_alert':
          payload = this.generateCodeScanningAlertWebhook();
          break;
        case 'push':
          payload = this.generatePushWebhook();
          break;
        case 'security_advisory':
          payload = this.generateSecurityAdvisoryWebhook();
          break;
      }

      return {
        id: `webhook-seq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'webhook_received',
        timestamp: new Date().toISOString(),
        data: { eventType, payload },
        source: 'webhook'
      };
    });
  }

  // Private helper methods

  private static randomChoice<T>(choices: readonly T[]): T {
    return choices[Math.floor(Math.random() * choices.length)];
  }

  private static generateSecurityFindings() {
    const critical = Math.floor(Math.random() * 3);
    const high = Math.floor(Math.random() * 5);
    const medium = Math.floor(Math.random() * 8);
    const low = Math.floor(Math.random() * 12);
    const note = Math.floor(Math.random() * 15);

    return {
      critical,
      high,
      medium,
      low,
      note,
      total: critical + high + medium + low + note
    };
  }

  private static generateCommitSha(): string {
    return Array.from({ length: 40 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  private static generateCommit() {
    return {
      id: this.generateCommitSha(),
      message: this.generateCommitMessage(),
      author: {
        name: this.randomChoice(['Alice Smith', 'Bob Jones', 'Carol Brown']),
        email: this.randomChoice(['alice@company.com', 'bob@company.com', 'carol@company.com'])
      },
      added: this.randomChoice([[], ['new-file.js'], ['src/utils.ts', 'tests/utils.test.ts']]),
      removed: this.randomChoice([[], ['old-file.js']]),
      modified: this.randomChoice([['README.md'], ['src/main.ts'], ['package.json', 'src/app.ts']])
    };
  }

  private static generateCommitMessage(): string {
    const types = ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore'];
    const scopes = ['auth', 'api', 'ui', 'db', 'security'];
    const messages = [
      'add user authentication',
      'fix memory leak in event handler',
      'update API documentation',
      'implement rate limiting',
      'refactor webhook processing',
      'add integration tests',
      'update dependencies'
    ];

    const type = this.randomChoice(types);
    const scope = this.randomChoice(scopes);
    const message = this.randomChoice(messages);

    return `${type}(${scope}): ${message}`;
  }

  private static mapSeverityToSecurityLevel(severity: 'error' | 'warning' | 'note') {
    switch (severity) {
      case 'error':
        return this.randomChoice(['critical', 'high'] as const);
      case 'warning':
        return this.randomChoice(['medium', 'low'] as const);
      case 'note':
        return this.randomChoice(['low', null] as const);
    }
  }

  private static generateRuleId(): string {
    const categories = ['js', 'py', 'java', 'cs', 'go', 'rb'];
    const rules = [
      'sql-injection',
      'xss',
      'path-traversal',
      'command-injection',
      'hardcoded-credentials',
      'weak-cryptography',
      'insecure-random',
      'unsafe-deserialization'
    ];

    return `${this.randomChoice(categories)}/${this.randomChoice(rules)}`;
  }

  private static generateRuleDescription(severity: string): string {
    const descriptions = {
      error: [
        'SQL injection vulnerability detected in database query',
        'Cross-site scripting (XSS) vulnerability in user input handling',
        'Command injection vulnerability in system call',
        'Path traversal vulnerability in file operations'
      ],
      warning: [
        'Potential weak cryptographic algorithm usage',
        'Hardcoded credentials detected in source code',
        'Insecure random number generation',
        'Potential information disclosure in error messages'
      ],
      note: [
        'Code quality issue detected',
        'Potential performance improvement opportunity',
        'Documentation improvement suggested',
        'Best practice violation detected'
      ]
    };

    return this.randomChoice(descriptions[severity as keyof typeof descriptions] || descriptions.note);
  }

  private static generateSecuritySummary(severity: string): string {
    return `${severity.charAt(0).toUpperCase() + severity.slice(1)} severity security vulnerability`;
  }

  private static generateSecurityDescription(severity: string): string {
    const descriptions = [
      'A security vulnerability has been identified that could allow attackers to compromise system security.',
      'This vulnerability could potentially be exploited to gain unauthorized access to sensitive data.',
      'An authentication bypass vulnerability has been discovered that requires immediate attention.',
      'A remote code execution vulnerability has been found that could allow arbitrary code execution.'
    ];

    return this.randomChoice(descriptions);
  }

  private static generatePackageName(ecosystem: string): string {
    const packages = {
      npm: ['lodash', 'express', 'axios', 'react', 'angular'],
      pip: ['django', 'flask', 'requests', 'numpy', 'pandas'],
      maven: ['spring-boot', 'junit', 'log4j', 'jackson', 'hibernate'],
      nuget: ['Newtonsoft.Json', 'EntityFramework', 'AutoMapper', 'Serilog'],
      rubygems: ['rails', 'devise', 'puma', 'sidekiq', 'nokogiri']
    };

    return this.randomChoice(packages[ecosystem as keyof typeof packages] || packages.npm);
  }

  private static generateVersionRange(): string {
    const major = Math.floor(Math.random() * 5) + 1;
    const minor = Math.floor(Math.random() * 10);
    return `< ${major}.${minor}.0`;
  }

  private static generateVersion(): string {
    const major = Math.floor(Math.random() * 5) + 1;
    const minor = Math.floor(Math.random() * 10);
    const patch = Math.floor(Math.random() * 10);
    return `${major}.${minor}.${patch}`;
  }

  private static generateRandomString(length: number): string {
    return Array.from({ length }, () => 
      Math.random().toString(36)[2] || '0'
    ).join('');
  }
}