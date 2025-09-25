import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubService } from '@/lib/github-service';
import type { SarifAnalysis } from '@/types/dashboard';
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
      headers: {
        get: (header: string) => {
          if (header === 'X-RateLimit-Remaining') return '50';
          if (header === 'X-RateLimit-Limit') return '60';
          if (header === 'X-RateLimit-Reset') return String(Math.floor(Date.now() / 1000) + 3600);
          return null;
        }
      }
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

describe('GitHubService workflow dispatch error handling', () => {
  it('should provide specific error message for 403 workflow dispatch errors', async () => {
    (global as any).__DISABLE_GITHUB_CACHE__ = true;
    
    mockFetchSequence([{
      ok: false,
      status: 403,
      json: {
        message: "Resource not accessible by personal access token",
        documentation_url: "https://docs.github.com/rest/actions/workflows#create-a-workflow-dispatch-event"
      }
    }]);
    
    const svc = new GitHubService({ token: 't', organization: 'org' });
    
    await expect(svc.dispatchWorkflow('repo1', 123, 'main'))
      .rejects
      .toThrow(/Failed to dispatch workflow.*Insufficient permissions/);
  });

  it('should handle dispatchCodeQLScan with better error messages', async () => {
    (global as any).__DISABLE_GITHUB_CACHE__ = true;
    
    mockFetchSequence([{
      ok: true,
      json: { workflows: [] }
    }]);
    
    const svc = new GitHubService({ token: 't', organization: 'org' });
    
    await expect(svc.dispatchCodeQLScan('repo1'))
      .rejects
      .toThrow(/No CodeQL workflow found.*Ensure a CodeQL workflow exists with workflow_dispatch trigger/);
  });

  it('should provide permission-specific error for CodeQL scan dispatch failure', async () => {
    (global as any).__DISABLE_GITHUB_CACHE__ = true;
    
    mockFetchSequence([{
      ok: false,
      status: 403,
      json: {}
    }]);
    
    const svc = new GitHubService({ token: 't', organization: 'org' });
    
    await expect(svc.dispatchCodeQLScan('repo1'))
      .rejects
      .toThrow(/Cannot dispatch CodeQL scan.*403 listing workflows/);
  });
});

describe('GitHubService ancillary functions', () => {
  it('finds CodeQL workflow then dispatches scan and fetches user/org info', async () => {
    (global as any).__DISABLE_GITHUB_CACHE__ = true; // ensure deterministic fetch sequence
    GitHubService.clearCache();
    mockFetchSequence([
      // Pre-flight permission check: list workflows
      { json: { workflows: [ { id: 321, name: 'CodeQL', path: '.github/workflows/codeql.yml' } ] } },
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

describe('GitHubService SARIF & Default Setup methods', () => {
  beforeEach(() => {
    GitHubService.clearCache();
    vi.restoreAllMocks();
  });

  it('retrieves analyses list and latest analysis', async () => {
    const analyses: SarifAnalysis[] = [
      { id: 10, ref: 'refs/heads/main', commit_sha: 'abc', analysis_key: 'codeql/js', created_at: new Date().toISOString(), results_count: 5, rules_count: 20, sarif_id: 's1', tool: { name: 'CodeQL' }, deletable: false }
    ];
    mockFetchSequence([
      { json: analyses }, // getCodeScanningAnalyses
    ]);
    const svc = new GitHubService({ token: 't', organization: 'org' });
    const list = await svc.getCodeScanningAnalyses('repo1');
    expect(list.length).toBe(1);
    const latest = await svc.getLatestAnalysis('repo1');
    expect(latest?.id).toBe(10);
  });

  it('fetches SARIF data with correct Accept header override', async () => {
    const sarifPayload = { version: '2.1.0', runs: [] };
  (global as any).fetch = vi.fn(async (_url: string, _init: any) => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => sarifPayload,
      text: async () => JSON.stringify(sarifPayload),
      headers: { get: () => null }
    }));
    const svc = new GitHubService({ token: 't', organization: 'org' });
    const data = await svc.getSarifData('repo1', 42);
    expect(data.version).toBe('2.1.0');
  expect((fetch as any).mock.calls[0][1].headers['Accept']).toBe('application/sarif+json');
  });

  it('returns null default setup config on 404', async () => {
    (global as any).fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ message: 'Not Found' }),
      text: async () => JSON.stringify({ message: 'Not Found' }),
      headers: { get: () => null }
    }));
    const svc = new GitHubService({ token: 't', organization: 'org' });
    const cfg = await svc.getDefaultSetupConfig('repo1');
    expect(cfg).toBeNull();
  });

  it('aggregates historical analyses across multiple pages within date window', async () => {
    const now = new Date().toISOString();
    mockFetchSequence([
      { json: [ { id: 1, ref: 'r', commit_sha: '1', analysis_key: 'k', created_at: now, results_count: 1, rules_count: 1, sarif_id: 'a', tool: { name: 'CodeQL' }, deletable: false } ] },
      { json: [] }
    ]);
    const svc = new GitHubService({ token: 't', organization: 'org' });
    const hist = await svc.getHistoricalAnalyses('repo1', 7);
    expect(hist.length).toBe(1);
  });

  it('analyzes repository setup for default, advanced, and none', async () => {
    const recent = new Date().toISOString();
    // Sequence for default setup scenario
    mockFetchSequence([
      // default setup config (configured)
      { json: { state: 'configured', languages: ['javascript'] } },
      // workflows (only default file)
      { json: { workflows: [ { id: 1, name: 'CodeQL', path: '.github/workflows/codeql.yml' } ] } },
      // latest analyses list
      { json: [ { id: 99, ref: 'r', commit_sha: 'c', analysis_key: 'k', created_at: recent, results_count: 3, rules_count: 10, sarif_id: 's', tool: { name: 'CodeQL' }, deletable: false } ] },
      // advanced scenario: default config 404
      { ok: false, status: 404, json: { message: 'Not Found' } },
      // workflows includes advanced
      { json: { workflows: [ { id: 2, name: 'CodeQL Advanced', path: '.github/workflows/codeql-advanced.yml' } ] } },
      // analyses list
      { json: [ { id: 100, ref: 'r', commit_sha: 'd', analysis_key: 'k', created_at: recent, results_count: 5, rules_count: 11, sarif_id: 's2', tool: { name: 'CodeQL' }, deletable: false } ] },
      // none scenario: default 404
      { ok: false, status: 404, json: { message: 'Not Found' } },
      // workflows empty
      { json: { workflows: [] } },
      // analyses empty
      { json: [] }
    ]);
    const svc = new GitHubService({ token: 't', organization: 'org' });
    const def = await svc.analyzeRepositorySetup('repo1');
    expect(def.setupType).toBe('default');
    const adv = await svc.analyzeRepositorySetup('repo2');
    expect(adv.setupType).toBe('advanced');
    const none = await svc.analyzeRepositorySetup('repo3');
    expect(none.setupType).toBe('none');
  });
});
