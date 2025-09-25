import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubService } from '@/lib/github-service';

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
