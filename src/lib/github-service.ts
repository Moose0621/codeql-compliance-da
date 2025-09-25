import { Octokit } from '@octokit/core';
import type { Repository, WorkflowRun, CodeQLAlert, SecurityFindings } from '@/types/dashboard';

export class GitHubService {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || process.env.GITHUB_TOKEN
    });
  }

  async getRepositories(org: string = 'octodemo'): Promise<Repository[]> {
    try {
      const { data: repos } = await this.octokit.request('GET /orgs/{org}/repos', {
        org,
        per_page: 100,
        sort: 'updated',
        direction: 'desc'
      });

      const repositories: Repository[] = [];

      for (const repo of repos) {
        const hasCodeQLWorkflow = await this.checkCodeQLWorkflow(repo.owner.login, repo.name);
        
        if (hasCodeQLWorkflow) {
          const lastScan = await this.getLastScanInfo(repo.owner.login, repo.name);
          const securityFindings = await this.getSecurityFindings(repo.owner.login, repo.name);

          repositories.push({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            owner: {
              login: repo.owner.login,
              avatar_url: repo.owner.avatar_url
            },
            has_codeql_workflow: true,
            workflow_dispatch_enabled: true,
            default_branch: repo.default_branch || 'main',
            last_scan_date: lastScan?.created_at || undefined,
            last_scan_status: (lastScan?.conclusion === 'success' ? 'success' : 
                            lastScan?.conclusion === 'failure' ? 'failure' :
                            lastScan?.status === 'in_progress' ? 'in_progress' : 'pending') as 'success' | 'failure' | 'in_progress' | 'pending',
            security_findings: securityFindings
          });
        }
      }

      return repositories;
    } catch (error) {
      console.error('Error fetching repositories:', error);
      return [];
    }
  }

  private async checkCodeQLWorkflow(owner: string, repo: string): Promise<boolean> {
    try {
      const { data: workflows } = await this.octokit.request('GET /repos/{owner}/{repo}/actions/workflows', {
        owner,
        repo
      });

      return workflows.workflows.some(workflow => 
        workflow.name.toLowerCase().includes('codeql') ||
        workflow.path.includes('codeql')
      );
    } catch (error) {
      console.error(`Error checking CodeQL workflow for ${owner}/${repo}:`, error);
      return false;
    }
  }

  private async getLastScanInfo(owner: string, repo: string): Promise<WorkflowRun | null> {
    try {
      const { data: runs } = await this.octokit.request('GET /repos/{owner}/{repo}/actions/runs', {
        owner,
        repo,
        per_page: 1,
        event: 'workflow_dispatch'
      });

      return runs.workflow_runs[0] || null;
    } catch (error) {
      console.error(`Error fetching workflow runs for ${owner}/${repo}:`, error);
      return null;
    }
  }

  private async getSecurityFindings(owner: string, repo: string): Promise<SecurityFindings> {
    try {
      const { data: alerts } = await this.octokit.request('GET /repos/{owner}/{repo}/code-scanning/alerts', {
        owner,
        repo,
        state: 'open',
        per_page: 100
      });

      const findings: SecurityFindings = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        note: 0,
        total: alerts.length
      };

      alerts.forEach((alert: any) => {
        const severity = alert.rule?.security_severity_level || 
                        (alert.rule?.severity === 'error' ? 'high' : 
                         alert.rule?.severity === 'warning' ? 'medium' : 'low');
        
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
        }
      });

      return findings;
    } catch (error) {
      console.error(`Error fetching security findings for ${owner}/${repo}:`, error);
      return {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        note: 0,
        total: 0
      };
    }
  }

  async dispatchWorkflow(owner: string, repo: string, workflowId: string = 'codeql.yml'): Promise<boolean> {
    try {
      await this.octokit.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
        owner,
        repo,
        workflow_id: workflowId,
        ref: 'main'
      });

      return true;
    } catch (error) {
      console.error(`Error dispatching workflow for ${owner}/${repo}:`, error);
      return false;
    }
  }
}