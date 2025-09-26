/**
 * Test Data Management for Webhook Integration Tests
 * Provides comprehensive webhook payload templates and test scenarios
 */

export interface TestScenario {
  name: string;
  description: string;
  webhookType: string;
  payload: object;
  expectedUIChanges: Array<{
    selector: string;
    expectedValue: string | RegExp;
    timeout?: number;
  }>;
  securityTest?: boolean;
  performanceTest?: boolean;
}

export class WebhookTestDataManager {
  /**
   * Generate large payload for performance/security testing
   */
  static generateLargePayload(sizeKB: number): object {
    const largeData = 'A'.repeat(sizeKB * 1024);
    
    return {
      ref: 'refs/heads/main',
      repository: { id: 1, name: 'test-repo-1', full_name: 'test-org/test-repo-1' },
      large_field: largeData,
      metadata: {
        size_bytes: sizeKB * 1024,
        generated_at: new Date().toISOString()
      }
    };
  }

  /**
   * Get comprehensive GitHub webhook event payload templates
   */
  static getWebhookPayloadTemplates(): Record<string, object> {
    return {
      // Push events
      push_main_branch: {
        ref: 'refs/heads/main',
        before: '0000000000000000000000000000000000000000',
        after: 'abc123def456789012345678901234567890abcd',
        repository: {
          id: 1,
          name: 'test-repo-1',
          full_name: 'test-org/test-repo-1',
          owner: { login: 'test-org', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
          default_branch: 'main',
          private: false
        },
        commits: [{
          id: 'abc123def456789012345678901234567890abcd',
          message: 'feat: add new security scanning capability',
          timestamp: new Date().toISOString(),
          author: {
            name: 'Security Developer',
            email: 'security@example.com'
          }
        }]
      },

      // Pull Request events
      pull_request_opened: {
        action: 'opened',
        number: 123,
        pull_request: {
          id: 987654321,
          number: 123,
          state: 'open',
          title: 'Fix critical security vulnerability in authentication',
          body: 'This PR addresses CVE-2024-12345 by implementing proper input validation.',
          head: { ref: 'security-fix-branch', sha: 'def456' },
          base: { ref: 'main', sha: 'abc123' },
          user: { login: 'security-reviewer', id: 12345 }
        },
        repository: {
          id: 1,
          name: 'test-repo-1',
          full_name: 'test-org/test-repo-1'
        }
      },

      // Code Scanning Alert events
      code_scanning_alert_created: {
        action: 'created',
        alert: {
          number: 42,
          created_at: new Date().toISOString(),
          state: 'open',
          rule: {
            id: 'js/sql-injection',
            name: 'SQL Injection',
            severity: 'error',
            security_severity_level: 'high',
            description: 'Untrusted user input in SQL query'
          },
          tool: { name: 'CodeQL', version: '2.15.3' }
        },
        repository: { id: 1, name: 'test-repo-1', full_name: 'test-org/test-repo-1' }
      },

      // Workflow Run events
      workflow_run_completed: {
        action: 'completed',
        workflow_run: {
          id: 123456789,
          name: 'CodeQL',
          status: 'completed',
          conclusion: 'success',
          created_at: new Date(Date.now() - 300000).toISOString(),
          updated_at: new Date().toISOString()
        },
        repository: { id: 1, name: 'test-repo-1', full_name: 'test-org/test-repo-1' }
      },

      // Repository events
      repository_archived: {
        action: 'archived',
        repository: {
          id: 1,
          name: 'test-repo-1',
          full_name: 'test-org/test-repo-1',
          archived: true,
          owner: { login: 'test-org' }
        }
      },

      // Issues events
      issues_opened: {
        action: 'opened',
        issue: {
          id: 111222333,
          number: 456,
          title: 'Security alert: High severity vulnerability detected',
          body: 'CodeQL has detected a high severity security vulnerability.',
          user: { login: 'security-scanner', id: 98765 },
          state: 'open'
        },
        repository: { id: 1, name: 'test-repo-1', full_name: 'test-org/test-repo-1' }
      }
    };
  }

  /**
   * Generate malicious payloads for security testing
   */
  static getMaliciousPayloads(): Record<string, object> {
    return {
      sql_injection: {
        action: 'opened',
        issue: {
          title: "Test'; DROP TABLE repositories; --",
          body: "'; SELECT * FROM users; --"
        },
        repository: { id: 1, name: 'test-repo-1' }
      },

      xss_script: {
        action: 'opened',
        issue: {
          title: '<script>alert("XSS")</script>Malicious Issue',
          body: '<img src=x onerror=alert("XSS")>'
        },
        repository: { id: 1, name: 'test-repo-1' }
      }
    };
  }

  /**
   * Generate test data for specific repository configurations
   */
  static generateRepositoryTestData(repoCount: number): Array<{
    id: number;
    name: string;
    full_name: string;
    owner: { login: string };
  }> {
    return Array.from({ length: repoCount }, (_, i) => ({
      id: i + 1,
      name: `test-repo-${i + 1}`,
      full_name: `test-org/test-repo-${i + 1}`,
      owner: { login: 'test-org' }
    }));
  }
}