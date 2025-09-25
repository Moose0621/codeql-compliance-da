import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubService, createGitHubService } from '@/lib/github-service';
/* eslint-disable @typescript-eslint/no-explicit-any */

// Helper to build mock fetch responses
function mockFetchSequence(responses: Array<{ ok?: boolean; status?: number; statusText?: string; json?: any }>) {
  let call = 0;
  (global as any).fetch = vi.fn(async () => {
    const r = responses[call];
    call++;
    if (!r) throw new Error('Unexpected fetch call index ' + call);
    return {
      ok: r.ok !== false,
      status: r.status ?? 200,
      statusText: r.statusText ?? 'OK',
      json: async () => r.json,
      text: async () => JSON.stringify(r.json || {}),
    } as any;
  });
}

describe('GitHubService.getSecurityFindings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    GitHubService.clearCache();
  });

  it('aggregates severity levels including derived mapping', async () => {
    mockFetchSequence([
      { json: [
        { rule: { security_severity_level: 'critical', severity: 'error' } },
        { rule: { security_severity_level: null, severity: 'error' } }, // maps to high
        { rule: { security_severity_level: null, severity: 'warning' } }, // medium
        { rule: { security_severity_level: null, severity: 'note' } }, // note
        { rule: { security_severity_level: 'low', severity: 'warning' } }
      ]},
    ]);

    const svc = new GitHubService({ token: 't', organization: 'org' });
    const findings = await svc.getSecurityFindings('repo1');
    expect(findings.total).toBe(5);
    expect(findings.critical).toBe(1);
    expect(findings.high).toBe(1);
    expect(findings.medium).toBe(1);
    expect(findings.low).toBe(1);
    expect(findings.note).toBe(1);
  });

  it('returns zeroed findings on API failure', async () => {
    (global as any).fetch = vi.fn(async () => ({ ok: false, status: 500, statusText: 'ERR', text: async () => 'boom' }));
    const svc = new GitHubService({ token: 't', organization: 'org' });
    const findings = await svc.getSecurityFindings('repo1');
    expect(findings.total).toBe(0);
  });
});

describe('GitHubService.mapWorkflowStatus (indirect via getWorkflowRuns path)', () => {
  it('maps various statuses correctly through private helper by simulating getWorkflowRuns consumer', async () => {
    // Calls: getWorkflowRuns -> makeRequest
    GitHubService.clearCache();
    mockFetchSequence([
      { json: { workflow_runs: [ { id: 1, name: 'CodeQL Analysis', path: '.github/workflows/codeql.yml', status: 'in_progress', conclusion: null, created_at: '', updated_at: '', html_url: '' } ] } },
    ]);
    const svc = new GitHubService({ token: 't', organization: 'org' });
    const runs = await svc.getWorkflowRuns('repo1', 'codeql');
    expect(runs[0].status).toBe('in_progress');
  });
});

describe('GitHubService ancillary functions', () => {
  it('finds CodeQL workflow then dispatches scan and fetches user/org info', async () => {
    (global as any).__DISABLE_GITHUB_CACHE__ = true; // ensure deterministic fetch sequence
    GitHubService.clearCache();
    mockFetchSequence([
      // initial findCodeQLWorkflow
      { json: { workflows: [ { id: 321, name: 'CodeQL', path: '.github/workflows/codeql.yml' } ] } },
      // findCodeQLWorkflow again inside dispatchCodeQLScan
      { json: { workflows: [ { id: 321, name: 'CodeQL', path: '.github/workflows/codeql.yml' } ] } },
      // dispatch workflow POST (returns empty object)
      { json: {} },
      // user info
      { json: { login: 'tester' } },
      // org info
      { json: { login: 'org' } }
    ]);

    const svc = new GitHubService({ token: 't', organization: 'org' });
    const id = await svc.findCodeQLWorkflow('repo1');
    expect(id).toBe(321);
    await svc.dispatchCodeQLScan('repo1');
    const user = await svc.getUserInfo();
    expect(user.login).toBe('tester');
    const org = await svc.getOrganizationInfo();
    expect(org.login).toBe('org');
  });
});

describe('GitHubService caching & error handling', () => {
  beforeEach(() => {
    GitHubService.clearCache();
    delete (globalThis as any).__DISABLE_GITHUB_CACHE__;
  });

  it('caches GET responses (single fetch for repeated user info)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => ({ login: 'cached' }), text: async () => '{}', headers: { get: () => null } }));
    (global as any).fetch = fetchMock;
    const svc = new GitHubService({ token: 't', organization: 'org' });
    const first = await svc.getUserInfo();
    const second = await svc.getUserInfo();
    expect(first.login).toBe('cached');
    expect(second.login).toBe('cached');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws enriched error message on 403 rate limit response', async () => {
    (global as any).fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({}),
      text: async () => 'rate limit exceeded for requests',
      headers: { get: (h: string) => (h === 'X-RateLimit-Remaining' ? '0' : h === 'X-RateLimit-Limit' ? '60' : h === 'X-RateLimit-Reset' ? String(Math.floor(Date.now()/1000)+1) : null) }
    }));
    const svc = new GitHubService({ token: 't', organization: 'org' });
    await expect(svc.getUserInfo()).rejects.toThrow(/403/);
  });
});

describe('GitHubService factory', () => {
  it('creates service instance with provided config', () => {
    const service = createGitHubService('test-token', 'test-org');
    expect(service).toBeInstanceOf(GitHubService);
  });
});
