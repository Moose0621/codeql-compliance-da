import { describe, it, expect } from 'vitest';
import { validateSarif, computeFreshnessSummary, buildAggregatedSarifPayload } from '@/lib/sarif-utils';
import type { Repository, SarifData } from '@/types/dashboard';

describe('sarif-utils', () => {
  it('validates basic SARIF structure', () => {
  const good: SarifData = { version: '2.1.0', runs: [{ tool: { driver: { name: 'CodeQL' } } }] } as SarifData;
    const bad = { version: '1.0.0', runs: [] };
    expect(validateSarif(good)).toBe(true);
    expect(validateSarif(bad)).toBe(false);
  });

  it('computes freshness summary buckets', () => {
    const now = Date.now();
    const h = (hrs: number) => new Date(now - hrs * 3600 * 1000).toISOString();
    const repos: Repository[] = [
      { id:1,name:'a',full_name:'a',owner:{login:'o',avatar_url:''},has_codeql_workflow:true,workflow_dispatch_enabled:false,default_branch:'main',last_scan_status:'success',last_scan_date:h(2) },
      { id:2,name:'b',full_name:'b',owner:{login:'o',avatar_url:''},has_codeql_workflow:true,workflow_dispatch_enabled:false,default_branch:'main',last_scan_status:'success',last_scan_date:h(30) },
      { id:3,name:'c',full_name:'c',owner:{login:'o',avatar_url:''},has_codeql_workflow:true,workflow_dispatch_enabled:false,default_branch:'main',last_scan_status:'success',last_scan_date:h(200) },
      { id:4,name:'d',full_name:'d',owner:{login:'o',avatar_url:''},has_codeql_workflow:true,workflow_dispatch_enabled:false,default_branch:'main',last_scan_status:'pending' }
    ];
    const summary = computeFreshnessSummary(repos);
    expect(summary.buckets.fresh24h).toBe(1);
    expect(summary.buckets.stale7d).toBe(1);
    expect(summary.buckets.old).toBe(1);
    expect(summary.buckets.never).toBe(1);
  });

  it('builds aggregated sarif payload', () => {
    const payload = buildAggregatedSarifPayload([
      { repository: 'repo1', analysis_id: 1, commit_sha: 'abc', sarif: { error: 'no-analysis' } }
    ]);
    expect(payload.repositories.length).toBe(1);
  });
});
