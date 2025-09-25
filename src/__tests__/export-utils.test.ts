import { describe, it, expect } from 'vitest';
import { ComplianceReportGenerator } from '@/lib/export-utils';
import type { Repository } from '@/types/dashboard';

function sampleRepos(): Repository[] {
  return [
    {
      id: 1,
      name: 'repo-a',
      full_name: 'org/repo-a',
      owner: { login: 'org', avatar_url: '' },
      has_codeql_workflow: true,
      workflow_dispatch_enabled: true,
      default_branch: 'main',
      last_scan_status: 'success',
      last_scan_date: new Date().toISOString(),
      security_findings: { critical: 1, high: 0, medium: 2, low: 0, note: 0, total: 3 }
    },
    {
      id: 2,
      name: 'repo-b',
      full_name: 'org/repo-b',
      owner: { login: 'org', avatar_url: '' },
      has_codeql_workflow: true,
      workflow_dispatch_enabled: true,
      default_branch: 'main',
      last_scan_status: 'success',
      last_scan_date: new Date().toISOString(),
      security_findings: { critical: 0, high: 1, medium: 0, low: 0, note: 0, total: 1 }
    }
  ];
}

describe('ComplianceReportGenerator', () => {
  it('computes summary and coverage metrics', () => {
    const report = ComplianceReportGenerator.generateReport(sampleRepos(), 'Acme');
    expect(report.summary.total_repositories).toBe(2);
    expect(report.summary.total_findings.total).toBe(4);
    expect(report.summary.last_scan_coverage).toBe(100);
    expect(report.fedramp_requirements.scan_frequency_met).toBe(true);
  });

  it('exports valid CSV header + rows', () => {
    const report = ComplianceReportGenerator.generateReport(sampleRepos(), 'Acme');
    const csv = ComplianceReportGenerator.exportAsCSV(report).split('\n');
    expect(csv[0]).toContain('Repository Name,Owner,Last Scan Date');
    expect(csv.length).toBeGreaterThan(1);
  });

  it('exports PDF HTML with required sections', () => {
    const report = ComplianceReportGenerator.generateReport(sampleRepos(), 'Acme');
    const html = ComplianceReportGenerator.exportAsPDF(report);
    expect(html).toContain('<h1>FedRAMP Compliance Security Report</h1>');
    expect(html).toContain('Executive Summary');
    expect(html).toContain('Repository Details');
  });
});
