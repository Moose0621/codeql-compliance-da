/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { analyzeCodeQLCapabilities, generateMigrationPlan, validateOnDemandScanning, type WorkflowCapabilities } from '@/lib/codeql-analysis';

// Minimal mock GitHubService interface subset
class MockGitHubService {
  constructor(private impl: Partial<Record<string, any>> = {}) {}
  getWorkflows(repo: string) { return this.impl.getWorkflows(repo); }
  findCodeQLWorkflow(repo: string) { return this.impl.findCodeQLWorkflow(repo); }
  getWorkflowRuns(repo: string, _name: string, _page: number, _per: number) { return this.impl.getWorkflowRuns(repo); }
  getSecurityFindings(repo: string) { return this.impl.getSecurityFindings(repo); }
}

const wf = (name: string, path: string) => ({ id: Math.random(), name, path });

describe('codeql-analysis capability assessment', () => {
  it('identifies no workflow scenario', async () => {
    const svc = new MockGitHubService({
      getWorkflows: () => [],
    }) as any;
    const caps = await analyzeCodeQLCapabilities(svc, 'repo1');
    expect(caps.workflowType).toBe('none');
    expect(caps.hasCodeQLWorkflow).toBe(false);
    expect(caps.recommendations.some(r => r.includes('No CodeQL workflow detected'))).toBe(true);
  });

  it('identifies advanced workflow with dispatch', async () => {
    const svc = new MockGitHubService({
      getWorkflows: () => [wf('CodeQL Advanced', '.github/workflows/codeql-advanced.yml')],
      findCodeQLWorkflow: () => 123
    }) as any;
    const caps = await analyzeCodeQLCapabilities(svc, 'repo2');
    expect(caps.workflowType).toBe('advanced-setup');
    expect(caps.canTriggerOnDemand).toBe(true);
  });

  it('identifies default setup workflow', async () => {
    const svc = new MockGitHubService({
      getWorkflows: () => [wf('CodeQL', '.github/workflows/codeql.yml')],
    }) as any;
    const caps = await analyzeCodeQLCapabilities(svc, 'repo3');
    expect(caps.workflowType).toBe('default-setup');
    expect(caps.canTriggerOnDemand).toBe(false);
  });

  it('handles permission error during dispatch check for advanced workflow', async () => {
    const svc = new MockGitHubService({
      getWorkflows: () => [wf('Advanced', '.github/workflows/codeql-adv.yml')],
      findCodeQLWorkflow: () => { throw new Error('403 forbidden'); }
    }) as any;
    const caps = await analyzeCodeQLCapabilities(svc, 'repo4');
    expect(caps.workflowType).toBe('advanced-setup');
    expect(caps.canTriggerOnDemand).toBe(false); // downgraded due to permission
    expect(caps.recommendations.some(r => r.includes('Permission issue'))).toBe(true);
  });
});

describe('generateMigrationPlan', () => {
  const base = (over: Partial<WorkflowCapabilities>): WorkflowCapabilities => ({
    hasCodeQLWorkflow: false,
    supportsWorkflowDispatch: false,
    workflowType: 'none',
    canTriggerOnDemand: false,
    recommendations: [],
    ...over
  });

  it('returns low priority when already optimal', () => {
    const plan = generateMigrationPlan(base({ canTriggerOnDemand: true }));
    expect(plan.priority).toBe('low');
  });

  it('returns high priority when no workflow', () => {
    const plan = generateMigrationPlan(base({ workflowType: 'none' }));
    expect(plan.priority).toBe('high');
    expect(plan.steps[0]).toMatch(/Choose between/);
  });

  it('returns medium priority for default setup migration', () => {
    const plan = generateMigrationPlan(base({ workflowType: 'default-setup' }));
    expect(plan.priority).toBe('medium');
    expect(plan.steps.some(s => s.includes('Disable Default Setup'))).toBe(true);
  });
});

describe('validateOnDemandScanning', () => {
  it('detects missing dispatchable workflow', async () => {
    const svc = new MockGitHubService({
      findCodeQLWorkflow: () => null,
      getWorkflowRuns: () => [],
      getSecurityFindings: () => ({ total: 0 })
    }) as any;
    const res = await validateOnDemandScanning(svc, 'r1');
    expect(res.isValid).toBe(false); // issue about no workflow
    expect(res.issues.some(i => i.includes('No CodeQL workflow'))).toBe(true);
    expect(res.suggestions.some(s => s.includes('workflow_dispatch'))).toBe(true);
  });

  it('reports failing latest run', async () => {
    const svc = new MockGitHubService({
      findCodeQLWorkflow: () => 7,
      getWorkflowRuns: () => [{ status: 'failure', conclusion: 'failure' }],
      getSecurityFindings: () => ({ total: 5 })
    }) as any;
    const res = await validateOnDemandScanning(svc, 'r2');
    expect(res.isValid).toBe(false);
    expect(res.issues.some(i => i.includes('failed'))).toBe(true);
  });

  it('handles permission error', async () => {
    const svc = new MockGitHubService({
      findCodeQLWorkflow: () => { throw new Error('403 permission'); },
      getWorkflowRuns: () => [],
      getSecurityFindings: () => ({ total: 0 })
    }) as any;
    const res = await validateOnDemandScanning(svc, 'r3');
    expect(res.isValid).toBe(false);
    expect(res.issues.some(i => i.includes('Permission'))).toBe(true);
  });
});
