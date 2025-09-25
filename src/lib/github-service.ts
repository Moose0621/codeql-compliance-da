import type { Repository, SecurityFindings, WorkflowRun, CodeQLAlert } from '@/types/dashboard';

interface GitHubConfig {
  token: string;
  organization: string;
}

export class GitHubService {
  private config: GitHubConfig;
  private baseUrl = 'https://api.github.com';

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `token ${this.config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;
      
      // Try to parse GitHub error response
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.message) {
          errorMessage += ` - ${errorData.message}`;
        }
      } catch {
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      }

      throw new Error(errorMessage);
    }

    return response.json();
  }

  async getOrganizationRepositories(page = 1, perPage = 30): Promise<Repository[]> {
    try {
      const repos = await this.makeRequest<any[]>(
        `/orgs/${this.config.organization}/repos?page=${page}&per_page=${perPage}&sort=updated&direction=desc`
      );

      const repositoriesWithWorkflows = await Promise.allSettled(
        repos.map(async (repo) => {
          try {
            // Check for CodeQL workflows
            const workflows = await this.getWorkflows(repo.name);
            const hasCodeQLWorkflow = workflows.some((workflow: any) => 
              workflow.name.toLowerCase().includes('codeql') || 
              workflow.path.includes('codeql')
            );

            // Get latest workflow runs for CodeQL
            let lastScanDate: string | undefined;
            let lastScanStatus: 'success' | 'failure' | 'in_progress' | 'pending' = 'pending';

            if (hasCodeQLWorkflow) {
              const runs = await this.getWorkflowRuns(repo.name, 'codeql');
              if (runs.length > 0) {
                const latestRun = runs[0];
                lastScanDate = latestRun.updated_at;
                lastScanStatus = this.mapWorkflowStatus(latestRun.status, latestRun.conclusion);
              }
            }

            // Get security findings
            const securityFindings = await this.getSecurityFindings(repo.name);

            return {
              id: repo.id,
              name: repo.name,
              full_name: repo.full_name,
              owner: {
                login: repo.owner.login,
                avatar_url: repo.owner.avatar_url,
              },
              has_codeql_workflow: hasCodeQLWorkflow,
              workflow_dispatch_enabled: hasCodeQLWorkflow,
              default_branch: repo.default_branch,
              last_scan_date: lastScanDate,
              last_scan_status: lastScanStatus,
              security_findings: securityFindings,
            } as Repository;
          } catch (error) {
            console.warn(`Failed to fetch details for ${repo.name}:`, error);
            return {
              id: repo.id,
              name: repo.name,
              full_name: repo.full_name,
              owner: {
                login: repo.owner.login,
                avatar_url: repo.owner.avatar_url,
              },
              has_codeql_workflow: false,
              workflow_dispatch_enabled: false,
              default_branch: repo.default_branch,
              last_scan_date: undefined,
              last_scan_status: 'pending',
              security_findings: {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                note: 0,
                total: 0,
              },
            } as Repository;
          }
        })
      );

      // Filter out failed promises and extract successful results
      return repositoriesWithWorkflows
        .filter((result): result is PromiseFulfilledResult<Repository> => result.status === 'fulfilled')
        .map(result => result.value);

    } catch (error) {
      console.error('Failed to fetch organization repositories:', error);
      throw error;
    }
  }

  async getWorkflows(repoName: string): Promise<any[]> {
    try {
      const response = await this.makeRequest<{ workflows: any[] }>(
        `/repos/${this.config.organization}/${repoName}/actions/workflows`
      );
      return response.workflows;
    } catch (error) {
      console.warn(`Failed to fetch workflows for ${repoName}:`, error);
      return [];
    }
  }

  async getWorkflowRuns(repoName: string, workflowName?: string, page = 1, perPage = 5): Promise<WorkflowRun[]> {
    try {
      let endpoint = `/repos/${this.config.organization}/${repoName}/actions/runs?page=${page}&per_page=${perPage}`;
      
      if (workflowName) {
        endpoint += `&event=schedule,workflow_dispatch,push`;
      }

      const response = await this.makeRequest<{ workflow_runs: any[] }>(endpoint);
      
      let runs = response.workflow_runs;
      
      // Filter for CodeQL runs if specified
      if (workflowName === 'codeql') {
        runs = runs.filter((run: any) => 
          run.name?.toLowerCase().includes('codeql') ||
          run.path?.includes('codeql')
        );
      }

      return runs.map((run: any) => ({
        id: run.id,
        status: run.status,
        conclusion: run.conclusion,
        created_at: run.created_at,
        updated_at: run.updated_at,
        html_url: run.html_url,
      }));
    } catch (error) {
      console.warn(`Failed to fetch workflow runs for ${repoName}:`, error);
      return [];
    }
  }

  async getSecurityFindings(repoName: string): Promise<SecurityFindings> {
    try {
      const alerts = await this.makeRequest<CodeQLAlert[]>(
        `/repos/${this.config.organization}/${repoName}/code-scanning/alerts?state=open&per_page=100`
      );

      const findings: SecurityFindings = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        note: 0,
        total: alerts.length,
      };

      alerts.forEach((alert) => {
        const severity = alert.rule.security_severity_level || this.mapRuleSeverity(alert.rule.severity);
        switch (severity) {
          case 'critical':
            findings.critical++;
            break;
          case 'high':
            findings.high++;
            break;
          case 'medium':
            findings.medium++;
            break;
          case 'low':
            findings.low++;
            break;
          default:
            findings.note++;
            break;
        }
      });

      return findings;
    } catch (error) {
      // If we can't access code scanning alerts (maybe no alerts exist or insufficient permissions)
      console.warn(`Failed to fetch security findings for ${repoName}:`, error);
      return {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        note: 0,
        total: 0,
      };
    }
  }

  async dispatchWorkflow(repoName: string, workflowId: string | number, ref: string = 'main'): Promise<void> {
    await this.makeRequest(
      `/repos/${this.config.organization}/${repoName}/actions/workflows/${workflowId}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: ref,
          inputs: {},
        }),
      }
    );
  }

  async findCodeQLWorkflow(repoName: string): Promise<number | null> {
    try {
      const workflows = await this.getWorkflows(repoName);
      const codeqlWorkflow = workflows.find((workflow) =>
        workflow.name.toLowerCase().includes('codeql') ||
        workflow.path.includes('codeql')
      );
      return codeqlWorkflow ? codeqlWorkflow.id : null;
    } catch (error) {
      console.error(`Failed to find CodeQL workflow for ${repoName}:`, error);
      return null;
    }
  }

  async dispatchCodeQLScan(repoName: string, ref: string = 'main'): Promise<void> {
    const workflowId = await this.findCodeQLWorkflow(repoName);
    if (!workflowId) {
      throw new Error(`No CodeQL workflow found for repository ${repoName}`);
    }
    
    await this.dispatchWorkflow(repoName, workflowId, ref);
  }

  async getUserInfo(): Promise<any> {
    return this.makeRequest('/user');
  }

  async getOrganizationInfo(): Promise<any> {
    return this.makeRequest(`/orgs/${this.config.organization}`);
  }

  private mapWorkflowStatus(status: string | null, conclusion: string | null): 'success' | 'failure' | 'in_progress' | 'pending' {
    if (status === 'in_progress' || status === 'queued') {
      return 'in_progress';
    }
    
    if (conclusion === 'success') {
      return 'success';
    }
    
    if (conclusion === 'failure' || conclusion === 'cancelled' || conclusion === 'timed_out') {
      return 'failure';
    }
    
    return 'pending';
  }

  private mapRuleSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' | 'note' {
    switch (severity.toLowerCase()) {
      case 'error':
        return 'high';
      case 'warning':
        return 'medium';
      case 'note':
      default:
        return 'note';
    }
  }
}

export function createGitHubService(token: string, organization: string): GitHubService {
  return new GitHubService({ token, organization });
}