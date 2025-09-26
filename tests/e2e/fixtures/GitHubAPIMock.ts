import { Page } from '@playwright/test';
import { TestDataGenerator } from '../data/TestDataGenerator';
import type { Repository } from '@/types/dashboard';

/**
 * GitHub API mock fixture for consistent test environment
 * Provides realistic API responses without external dependencies
 */
export class GitHubAPIMock {
  private repositories: Repository[] = [];
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Setup comprehensive API mocking for testing
   */
  async setupMocks(options: {
    repositoryCount?: number;
    includeSpecialCases?: boolean;
    enableRateLimit?: boolean;
  } = {}) {
    const { 
      repositoryCount = 50, 
      includeSpecialCases = true,
      enableRateLimit = false 
    } = options;

    // Generate test repositories
    this.repositories = TestDataGenerator.generateRepositories(repositoryCount);
    
    if (includeSpecialCases) {
      const specialRepos = TestDataGenerator.generateFilteredRepositories();
      this.repositories.push(
        ...specialRepos.typescript,
        ...specialRepos.highSeverity,
        ...specialRepos.noFindings,
        ...specialRepos.recentActivity,
        ...specialRepos.lowCompliance
      );
    }

    await this.setupRoutes(enableRateLimit);
  }

  /**
   * Setup API route handlers
   */
  private async setupRoutes(enableRateLimit: boolean) {
    // User info endpoint
    await this.page.route('**/api.github.com/user', (route) => {
      if (enableRateLimit && this.shouldRateLimit()) {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ 
            message: 'API rate limit exceeded',
            documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting'
          }),
          headers: {
            'X-RateLimit-Limit': '60',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600)
          }
        });
        return;
      }

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          login: 'test-user',
          name: 'Test User',
          avatar_url: 'https://avatars.githubusercontent.com/u/123?v=4'
        })
      });
    });

    // Organization repositories endpoint
    await this.page.route('**/api.github.com/orgs/*/repos**', (route) => {
      const url = new URL(route.request().url());
      const page = parseInt(url.searchParams.get('page') || '1');
      const perPage = parseInt(url.searchParams.get('per_page') || '30');
      
      const startIndex = (page - 1) * perPage;
      const endIndex = startIndex + perPage;
      const paginatedRepos = this.repositories.slice(startIndex, endIndex);

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(paginatedRepos.map(repo => this.transformToGitHubRepo(repo))),
        headers: {
          'Link': this.generateLinkHeader(page, perPage, this.repositories.length)
        }
      });
    });

    // Repository workflows endpoint
    await this.page.route('**/api.github.com/repos/*/actions/workflows**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          workflows: [
            {
              id: 12345,
              name: 'CodeQL Analysis',
              path: '.github/workflows/codeql.yml',
              state: 'active'
            }
          ]
        })
      });
    });

    // Repository workflow runs endpoint
    await this.page.route('**/api.github.com/repos/*/actions/runs**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          workflow_runs: [
            {
              id: 67890,
              status: 'completed',
              conclusion: 'success',
              created_at: new Date(Date.now() - 3600000).toISOString(),
              updated_at: new Date(Date.now() - 3000000).toISOString(),
              html_url: 'https://github.com/test-org/test-repo/actions/runs/67890'
            }
          ]
        })
      });
    });

    // Code scanning alerts endpoint
    await this.page.route('**/api.github.com/repos/*/code-scanning/alerts**', (route) => {
      const repoName = this.extractRepoFromUrl(route.request().url());
      const repo = this.repositories.find(r => r.name === repoName);
      
      if (repo?.security_findings) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(this.generateMockAlerts(repo.security_findings))
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      }
    });

    // Repository languages endpoint
    await this.page.route('**/api.github.com/repos/*/languages**', (route) => {
      const repoName = this.extractRepoFromUrl(route.request().url());
      const repo = this.repositories.find(r => r.name === repoName);
      
      const languages: Record<string, number> = {};
      repo?.languages?.forEach((lang, index) => {
        languages[lang] = 1000 * (repo.languages!.length - index); // Mock byte counts
      });

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(languages)
      });
    });

    // Repository topics endpoint (usually included in repo data, but separate endpoint exists)
    await this.page.route('**/api.github.com/repos/*/topics**', (route) => {
      const repoName = this.extractRepoFromUrl(route.request().url());
      const repo = this.repositories.find(r => r.name === repoName);

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          names: repo?.topics || []
        })
      });
    });
  }

  /**
   * Add specific repositories for targeted testing
   */
  addTestRepositories(repos: Repository[]) {
    this.repositories.push(...repos);
  }

  /**
   * Get current mock repositories
   */
  getRepositories(): Repository[] {
    return [...this.repositories];
  }

  /**
   * Transform internal Repository to GitHub API format
   */
  private transformToGitHubRepo(repo: Repository) {
    return {
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      owner: repo.owner,
      default_branch: repo.default_branch,
      language: repo.languages?.[0] || null,
      topics: repo.topics || [],
      updated_at: repo.last_activity_date,
      pushed_at: repo.last_activity_date,
      languages_url: `https://api.github.com/repos/${repo.full_name}/languages`,
      has_issues: true,
      has_projects: true,
      has_wiki: false
    };
  }

  /**
   * Generate mock CodeQL alerts based on security findings
   */
  private generateMockAlerts(findings: any) {
    const alerts = [];
    let alertId = 1;

    // Generate critical alerts
    for (let i = 0; i < findings.critical; i++) {
      alerts.push({
        number: alertId++,
        state: 'open',
        rule: {
          id: `critical-rule-${i + 1}`,
          severity: 'error',
          security_severity_level: 'critical',
          description: `Critical security vulnerability ${i + 1}`
        },
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // Generate high severity alerts
    for (let i = 0; i < findings.high; i++) {
      alerts.push({
        number: alertId++,
        state: 'open',
        rule: {
          id: `high-rule-${i + 1}`,
          severity: 'error',
          security_severity_level: 'high',
          description: `High security issue ${i + 1}`
        },
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // Add medium, low, and note alerts similarly...
    for (let i = 0; i < findings.medium; i++) {
      alerts.push({
        number: alertId++,
        state: 'open',
        rule: {
          id: `medium-rule-${i + 1}`,
          severity: 'warning',
          security_severity_level: 'medium',
          description: `Medium security issue ${i + 1}`
        },
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    return alerts;
  }

  /**
   * Generate GitHub-style pagination Link header
   */
  private generateLinkHeader(page: number, perPage: number, totalCount: number): string {
    const totalPages = Math.ceil(totalCount / perPage);
    const links = [];

    if (page < totalPages) {
      links.push(`<https://api.github.com/orgs/test-org/repos?page=${page + 1}&per_page=${perPage}>; rel="next"`);
      links.push(`<https://api.github.com/orgs/test-org/repos?page=${totalPages}&per_page=${perPage}>; rel="last"`);
    }

    if (page > 1) {
      links.push(`<https://api.github.com/orgs/test-org/repos?page=1&per_page=${perPage}>; rel="first"`);
      links.push(`<https://api.github.com/orgs/test-org/repos?page=${page - 1}&per_page=${perPage}>; rel="prev"`);
    }

    return links.join(', ');
  }

  /**
   * Extract repository name from GitHub API URL
   */
  private extractRepoFromUrl(url: string): string {
    const match = url.match(/\/repos\/[^\/]+\/([^\/]+)/);
    return match ? match[1] : '';
  }

  /**
   * Simulate rate limiting (for performance testing)
   */
  private shouldRateLimit(): boolean {
    return Math.random() < 0.1; // 10% chance of rate limiting
  }

  /**
   * Reset mock data for clean test isolation
   */
  reset() {
    this.repositories = [];
    TestDataGenerator.resetIdCounter();
  }
}