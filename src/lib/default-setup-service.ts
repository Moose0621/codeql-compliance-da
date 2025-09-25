import { GitHubService } from './github-service';
import type { Repository, SarifAnalysis, AnalysisResults, ScanSummary } from '@/types/dashboard';

/**
 * Thin wrapper that composes new public GitHubService SARIF methods into
 * higher‑level convenience functions for UI consumption (backwards compatible
 * with earlier prototype while removing use of private internals).
 */
export class DefaultSetupAnalysisService {
  constructor(private github: GitHubService) {}

  async getLatestDefaultSetupAnalysis(repo: string): Promise<SarifAnalysis | null> {
    return this.github.getLatestAnalysis(repo);
  }

  async getSarifData(repo: string, analysisId: number) {
    return this.github.getSarifData(repo, analysisId);
  }

  async getHistoricalAnalyses(repo: string, days = 30): Promise<SarifAnalysis[]> {
    return this.github.getHistoricalAnalyses(repo, days);
  }

  async analyzeLatestScanResults(repo: string): Promise<Omit<AnalysisResults, 'repository'>> {
    const analysis = await this.github.analyzeRepositorySetup(repo);
    // analyzeRepositorySetup already returns what we need except repository object (it focuses on setup)
    return {
      latestAnalysis: analysis.latestAnalysis,
      scanAge: analysis.scanAge,
      canRetrieveSarif: analysis.canRetrieveSarif,
      recommendedAction: analysis.recommendedAction,
      setupType: analysis.setupType
    };
  }

  async createDefaultSetupScanSummary(repo: string): Promise<ScanSummary> {
    // Gather base data
    const setup = await this.github.analyzeRepositorySetup(repo);
    const historical = await this.github.getHistoricalAnalyses(repo, 30);

    // We need basic repository info for summary (reuse organization repos call cheaply via direct fetch)
    // Provide a lightweight fallback repository object if not already discovered
    const repository: Repository = {
      id: 0,
      name: repo,
      full_name: repo, // Org prefix not available without extra call; can be enriched by caller
      owner: { login: '', avatar_url: '' },
      has_codeql_workflow: setup.setupType !== 'none',
      workflow_dispatch_enabled: setup.setupType === 'advanced',
      default_branch: 'main',
      last_scan_status: setup.latestAnalysis ? 'success' : 'pending',
      last_scan_date: setup.latestAnalysis?.created_at
    };

    const recommendations: string[] = [];
    if (!setup.latestAnalysis) {
      recommendations.push('No CodeQL analyses found - consider enabling Default Setup');
    } else if (setup.recommendedAction === 'refresh_needed') {
      recommendations.push(`Latest scan is ${setup.scanAge} hours old - consider reviewing recent commits.`);
    } else {
      recommendations.push('Scan results are current.');
    }

    return {
      repository,
      latestScan: setup.latestAnalysis ? {
        date: setup.latestAnalysis.created_at,
        status: 'success',
        resultsCount: setup.latestAnalysis.results_count,
        rulesCount: setup.latestAnalysis.rules_count,
        commitSha: setup.latestAnalysis.commit_sha,
        scanType: setup.setupType === 'advanced' ? 'advanced' : 'default-setup'
      } : null,
      historicalTrend: historical.map(a => ({ date: a.created_at, resultsCount: a.results_count, commitSha: a.commit_sha })),
      sarifAvailable: !!setup.latestAnalysis,
      recommendations,
      setupType: setup.setupType
    };
  }
}