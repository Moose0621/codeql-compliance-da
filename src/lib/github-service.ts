import type { 
  Repository, 
  SecurityFindings, 
  WorkflowRun, 
  CodeQLAlert,
  Workflow,
  GitHubRepository,
  GitHubUser,
  GitHubOrganization,
  WorkflowsResponse,
  WorkflowRunsResponse,
  WorkflowRunData
} from '@/types/dashboard';
/**
 * Architectural scalability notes (incremental implementation):
 * 1. Centralized rate limit tracking & adaptive backoff to prevent hard 403s.
 * 2. Lightweight in-memory + optional localStorage cache for GET requests (stale-while-revalidate pattern candidate).
 * 3. Concurrency limiter to avoid burst secondary limits.
 * 4. Org-level aggregation endpoint helper to reduce N+1 per-repo alert calls.
 *
 * This file now lays groundwork; future steps (server proxy, GitHub App auth, ETag revalidation, GraphQL batching)
 * are tracked separately and can hook into the primitives below without refactoring callers again.
 */

interface GitHubConfig {
  token: string;
  organization: string;
}

interface RateLimitState {
  remaining: number | null;
  reset: number | null; // epoch seconds
  limit: number | null;
  lastUpdated: number | null; // ms
}

type CacheEntry<T = unknown> = { data: T; fetchedAt: number; ttl: number };

export class GitHubService {
  private config: GitHubConfig;
  private baseUrl = 'https://api.github.com';
  // Basic in-memory cache (scoped per browser tab). Avoids refetch within short TTL windows.
  private static memoryCache: Map<string, CacheEntry> = new Map();
  // Concurrency control (simple token semaphore)
  private static inFlight = 0;
  private static MAX_CONCURRENT = 5; // conservative; adjust after monitoring
  private static queue: Array<() => void> = [];
  private static rateLimit: RateLimitState = { remaining: null, reset: null, limit: null, lastUpdated: null };

  // Default GET cache TTL (ms)
  private static DEFAULT_TTL = 60_000; // 60s - safe, reduces chatter while keeping data fresh-ish

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  /** Acquire a concurrency slot */
  private static async acquire() {
    if (this.inFlight < this.MAX_CONCURRENT) {
      this.inFlight++;
      return;
    }
    await new Promise<void>(resolve => this.queue.push(() => { this.inFlight++; resolve(); }));
  }

  /** Release a concurrency slot */
  private static release() {
    this.inFlight = Math.max(0, this.inFlight - 1);
    const next = this.queue.shift();
    if (next) next();
  }

  /** Basic adaptive wait if rate limit is nearly exhausted */
  private static async rateLimitGate() {
    const rl = this.rateLimit;
    if (rl.remaining !== null && rl.reset && rl.remaining < 5) {
      const now = Date.now();
      const resetMs = rl.reset * 1000;
      const waitFor = resetMs - now + 500; // small buffer
      if (waitFor > 0 && waitFor < 1000 * 60 * 5) { // cap wait to 5m
        await new Promise(r => setTimeout(r, waitFor));
      }
    }
  }

  /** Public accessor for UI telemetry */
  static getRateLimitState(): RateLimitState { return { ...this.rateLimit }; }
  static clearCache() { this.memoryCache.clear(); }

  private cacheKey(endpoint: string) {
    // Token is intentionally NOT included to avoid accidental leak when inspecting cache keys.
    // If multiple tokens are used concurrently for same org, a false positive cache share may occur (acceptable trade-off for now).
    return `${this.config.organization}::${endpoint}`;
  }

  private readCache<T>(key: string): T | null {
    const entry = GitHubService.memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > entry.ttl) {
      GitHubService.memoryCache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private writeCache<T>(key: string, data: T, ttl = GitHubService.DEFAULT_TTL) {
    GitHubService.memoryCache.set(key, { data, fetchedAt: Date.now(), ttl });
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}, { cacheTTL }: { cacheTTL?: number } = {}): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const isCacheable = method === 'GET' && cacheTTL !== 0;
    const key = this.cacheKey(endpoint);
    const disableCache = (globalThis as { __DISABLE_GITHUB_CACHE__?: boolean }).__DISABLE_GITHUB_CACHE__ === true;
    if (isCacheable && !disableCache) {
      const cached = this.readCache<T>(key);
      if (cached) return cached;
    }

    await GitHubService.rateLimitGate();
    await GitHubService.acquire();
  let response: Response | undefined;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...options.headers,
        },
      });

      // Update rate limit state when headers present
      const remaining = response.headers?.get('X-RateLimit-Remaining');
      const limit = response.headers?.get('X-RateLimit-Limit');
      const reset = response.headers?.get('X-RateLimit-Reset');
      if (remaining && limit && reset) {
        GitHubService.rateLimit = {
          remaining: Number(remaining),
            limit: Number(limit),
            reset: Number(reset),
            lastUpdated: Date.now(),
        };
      }

      if (response && response.status === 304 && isCacheable) {
        // Not Modified – use existing cache (should exist if we sent conditional request later when implemented)
        const cached = this.readCache<T>(key);
        if (cached) return cached;
      }

      if (!response || !response.ok) {
        // Handle secondary rate limits with adaptive delay (simplified heuristic)
        if (response && response.status === 403) {
          const bodyText = await response.text().catch(() => '');
          if (/rate limit/i.test(bodyText) || /abuse/i.test(bodyText)) {
            // Force gate to wait for reset next calls
            if (GitHubService.rateLimit.reset) {
              const wait = GitHubService.rateLimit.reset * 1000 - Date.now() + 1000;
              if (wait > 0) {
                await new Promise(r => setTimeout(r, Math.min(wait, 60_000))); // wait at most 60s inline
              }
            }
          }
          // Reconstruct error body for message
          throw new Error(`GitHub API error: 403 ${bodyText.substring(0, 200)}`);
        }
        const errorText = response ? await response.text().catch(() => '') : '';
        let errorMessage = response ? `GitHub API error: ${response.status} ${response.statusText}` : 'GitHub API error: unknown (no response)';
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message) errorMessage += ` - ${errorData.message}`;
        } catch {
          if (errorText) errorMessage += ` - ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      const json = await response.json();
  if (isCacheable && !disableCache) this.writeCache(key, json, cacheTTL || GitHubService.DEFAULT_TTL);
      return json;
    } finally {
      GitHubService.release();
    }

    // (Dead code path removed: error handling already performed above; function exited earlier.)
  }

  async getOrganizationRepositories(page = 1, perPage = 30): Promise<Repository[]> {
    try {
      const repos = await this.makeRequest<GitHubRepository[]>(
        `/orgs/${this.config.organization}/repos?page=${page}&per_page=${perPage}&sort=updated&direction=desc`,
        {},
        { cacheTTL: 30_000 }
      );

      // Stage 1: return lightweight objects first (defer heavy per-repo calls) – but to avoid refactor
      // of callers expecting enriched objects, we still enrich here with controlled concurrency.
      const results: Repository[] = [];
      const concurrency = 4;
      const queue = [...repos];
      const workers: Promise<void>[] = [];

      const worker = async () => {
        while (queue.length) {
          const repo = queue.shift();
          if (!repo) break;
          try {
            // Workflows (cached briefly)
            const workflows = await this.getWorkflows(repo.name);
            const hasCodeQLWorkflow = workflows.some((workflow: Workflow) =>
              workflow.name?.toLowerCase().includes('codeql') || workflow.path?.includes('codeql')
            );

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

            const securityFindings = await this.getSecurityFindings(repo.name);

            results.push({
              id: repo.id,
              name: repo.name,
              full_name: repo.full_name,
              owner: { login: repo.owner.login, avatar_url: repo.owner.avatar_url },
              has_codeql_workflow: hasCodeQLWorkflow,
              workflow_dispatch_enabled: hasCodeQLWorkflow,
              default_branch: repo.default_branch,
              last_scan_date: lastScanDate,
              last_scan_status: lastScanStatus,
              security_findings: securityFindings,
            });
          } catch (error) {
            console.warn(`Failed to hydrate repo ${repo.name}:`, error);
            results.push({
              id: repo.id,
              name: repo.name,
              full_name: repo.full_name,
              owner: { login: repo.owner.login, avatar_url: repo.owner.avatar_url },
              has_codeql_workflow: false,
              workflow_dispatch_enabled: false,
              default_branch: repo.default_branch,
              last_scan_date: undefined,
              last_scan_status: 'pending',
              security_findings: { critical: 0, high: 0, medium: 0, low: 0, note: 0, total: 0 },
            });
          }
        }
      };

      for (let i = 0; i < concurrency; i++) workers.push(worker());
      await Promise.all(workers);
      return results;

    } catch (error) {
      console.error('Failed to fetch organization repositories:', error);
      throw error;
    }
  }

  async getWorkflows(repoName: string): Promise<Workflow[]> {
    try {
      const response = await this.makeRequest<WorkflowsResponse>(
        `/repos/${this.config.organization}/${repoName}/actions/workflows`,
        {},
        { cacheTTL: 60_000 }
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

      const response = await this.makeRequest<WorkflowRunsResponse>(endpoint, {}, { cacheTTL: 15_000 });
      
      let runs = response.workflow_runs;
      
      // Filter for CodeQL runs if specified
      if (workflowName === 'codeql') {
        runs = runs.filter((run: WorkflowRunData) => 
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
        `/repos/${this.config.organization}/${repoName}/code-scanning/alerts?state=open&per_page=100`,
        {},
        { cacheTTL: 60_000 }
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
        workflow.name?.toLowerCase().includes('codeql') ||
        workflow.path?.includes('codeql')
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

  async getUserInfo(): Promise<GitHubUser> {
    return this.makeRequest<GitHubUser>('/user', {}, { cacheTTL: 300_000 });
  }

  async getOrganizationInfo(): Promise<GitHubOrganization> {
    return this.makeRequest<GitHubOrganization>(`/orgs/${this.config.organization}`, {}, { cacheTTL: 300_000 });
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