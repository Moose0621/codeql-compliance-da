import type { Repository, SecurityFindings } from '@/types/dashboard';

/**
 * Test data generator for creating realistic repository datasets
 */
export class TestDataGenerator {
  private static repositoryId = 1;

  /**
   * Generate a single repository with customizable properties
   */
  static generateRepository(overrides: Partial<Repository> = {}): Repository {
    const id = this.repositoryId++;
    const defaultRepo: Repository = {
      id,
      name: `test-repo-${id}`,
      full_name: `test-org/test-repo-${id}`,
      owner: {
        login: 'test-org',
        avatar_url: `https://avatars.githubusercontent.com/u/${id}?v=4`
      },
      has_codeql_workflow: true,
      last_scan_status: 'success',
      workflow_dispatch_enabled: true,
      default_branch: 'main',
      languages: ['JavaScript', 'TypeScript'],
      topics: ['web', 'security'],
      last_activity_date: new Date().toISOString(),
      team_slug: 'security-team',
      compliance_score: 85,
      security_findings: {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
        note: 1,
        total: 7
      }
    };

    return { ...defaultRepo, ...overrides };
  }

  /**
   * Generate multiple repositories with diverse characteristics
   */
  static generateRepositories(count: number): Repository[] {
    const repositories: Repository[] = [];
    const languages = ['JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'Go', 'Ruby', 'PHP'];
    const topics = ['web', 'security', 'api', 'mobile', 'backend', 'frontend', 'ml', 'devops'];
    const teams = ['security-team', 'frontend-team', 'backend-team', 'mobile-team'];
    const statuses = ['success', 'failure', 'in_progress', 'pending'] as const;

    for (let i = 0; i < count; i++) {
      const repository = this.generateRepository({
        languages: this.getRandomItems(languages, Math.floor(Math.random() * 3) + 1),
        topics: this.getRandomItems(topics, Math.floor(Math.random() * 4) + 1),
        team_slug: teams[Math.floor(Math.random() * teams.length)],
        last_scan_status: statuses[Math.floor(Math.random() * statuses.length)],
        compliance_score: Math.floor(Math.random() * 101),
        security_findings: this.generateSecurityFindings(),
        has_codeql_workflow: Math.random() > 0.2, // 80% have workflows
        workflow_dispatch_enabled: Math.random() > 0.3, // 70% have dispatch enabled
      });
      
      repositories.push(repository);
    }

    return repositories;
  }

  /**
   * Generate repositories with specific filter criteria for testing
   */
  static generateFilteredRepositories(): {
    typescript: Repository[];
    highSeverity: Repository[];
    noFindings: Repository[];
    recentActivity: Repository[];
    lowCompliance: Repository[];
  } {
    return {
      typescript: [
        this.generateRepository({
          name: 'typescript-app-1',
          languages: ['TypeScript', 'JavaScript'],
          topics: ['web', 'typescript'],
        }),
        this.generateRepository({
          name: 'typescript-lib-1',
          languages: ['TypeScript'],
          topics: ['library', 'typescript'],
        })
      ],
      highSeverity: [
        this.generateRepository({
          name: 'vulnerable-app-1',
          security_findings: {
            critical: 3,
            high: 5,
            medium: 2,
            low: 1,
            note: 0,
            total: 11
          }
        }),
        this.generateRepository({
          name: 'legacy-system-1',
          security_findings: {
            critical: 2,
            high: 8,
            medium: 10,
            low: 5,
            note: 2,
            total: 27
          }
        })
      ],
      noFindings: [
        this.generateRepository({
          name: 'clean-repo-1',
          security_findings: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            note: 0,
            total: 0
          }
        }),
        this.generateRepository({
          name: 'secure-app-1',
          security_findings: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            note: 0,
            total: 0
          },
          compliance_score: 98
        })
      ],
      recentActivity: [
        this.generateRepository({
          name: 'active-project-1',
          last_activity_date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          last_scan_date: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        }),
        this.generateRepository({
          name: 'daily-updated-1',
          last_activity_date: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
          last_scan_date: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        })
      ],
      lowCompliance: [
        this.generateRepository({
          name: 'non-compliant-1',
          compliance_score: 25,
          security_findings: {
            critical: 5,
            high: 10,
            medium: 15,
            low: 8,
            note: 2,
            total: 40
          }
        }),
        this.generateRepository({
          name: 'needs-work-1',
          compliance_score: 45,
          security_findings: {
            critical: 2,
            high: 6,
            medium: 12,
            low: 10,
            note: 5,
            total: 35
          }
        })
      ]
    };
  }

  /**
   * Generate large dataset for performance testing
   */
  static generateLargeDataset(size: number): Repository[] {
    console.log(`Generating ${size} repositories for performance testing...`);
    return this.generateRepositories(size);
  }

  /**
   * Generate security findings with realistic distribution
   */
  private static generateSecurityFindings(): SecurityFindings {
    const critical = Math.floor(Math.random() * 5);
    const high = Math.floor(Math.random() * 10);
    const medium = Math.floor(Math.random() * 15);
    const low = Math.floor(Math.random() * 20);
    const note = Math.floor(Math.random() * 10);
    
    return {
      critical,
      high,
      medium,
      low,
      note,
      total: critical + high + medium + low + note
    };
  }

  /**
   * Get random items from an array
   */
  private static getRandomItems<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, array.length));
  }

  /**
   * Reset repository ID counter (useful for consistent test data)
   */
  static resetIdCounter() {
    this.repositoryId = 1;
  }
}