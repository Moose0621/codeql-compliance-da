export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  has_codeql_workflow: boolean;
  last_scan_date?: string;
  last_scan_status: 'success' | 'failure' | 'in_progress' | 'pending';
  security_findings?: SecurityFindings;
  workflow_dispatch_enabled: boolean;
  default_branch: string;
}

export interface SecurityFindings {
  critical: number;
  high: number;
  medium: number;
  low: number;
  note: number;
  total: number;
}

export interface ScanRequest {
  id: string;
  repository: string;
  timestamp: string;
  status: 'dispatched' | 'running' | 'completed' | 'failed';
  duration?: number;
  findings?: SecurityFindings;
}

export interface WorkflowRun {
  id: number;
  status: string | null;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface CodeQLAlert {
  number: number;
  state: 'open' | 'dismissed' | 'fixed' | null;
  rule: {
    id: string;
    severity: 'error' | 'warning' | 'note';
    security_severity_level: 'critical' | 'high' | 'medium' | 'low' | null;
    description: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ComplianceReport {
  id: string;
  generated_at: string;
  generated_by: string;
  report_period: {
    start_date: string;
    end_date: string;
  };
  organization: string;
  repositories: Repository[];
  summary: {
    total_repositories: number;
    repositories_with_findings: number;
    total_findings: SecurityFindings;
    compliance_status: 'compliant' | 'non-compliant' | 'partial';
    last_scan_coverage: number; // percentage
  };
  fedramp_requirements: {
    scan_frequency_met: boolean;
    response_time_met: boolean;
    documentation_complete: boolean;
    remediation_tracked: boolean;
  };
}

// SARIF and Default Setup Analysis Types
export interface SarifAnalysis {
  id: number;
  ref: string;
  commit_sha: string;
  analysis_key: string;
  created_at: string;
  results_count: number;
  rules_count: number;
  sarif_id: string;
  tool: {
    name: string;
    version?: string;
  };
  category?: string;
  deletable: boolean;
  warning?: string;
}

export interface SarifData {
  version: string;
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version?: string;
        informationUri?: string;
        rules?: Array<{
          id: string;
          shortDescription?: { text: string };
          fullDescription?: { text: string };
          help?: { text: string; markdown?: string };
          properties?: Record<string, unknown>;
        }>;
      };
    };
    results?: Array<{
      ruleId?: string;
      message: { text: string };
      locations: Array<{
        physicalLocation: {
          artifactLocation: { uri: string };
          region: {
            startLine: number;
            endLine?: number;
            startColumn?: number;
            endColumn?: number;
          };
        };
      }>;
      properties?: Record<string, unknown>;
    }>;
    properties?: Record<string, unknown>;
  }>;
  properties?: Record<string, unknown>;
}

export interface DefaultSetupConfig {
  state: 'configured' | 'not-configured';
  languages?: string[];
  query_suite?: string;
  updated_at?: string;
}

export interface AnalysisResults {
  repository: Repository;
  latestAnalysis: SarifAnalysis | null;
  scanAge: number; // hours since last scan
  canRetrieveSarif: boolean;
  recommendedAction: 'current' | 'refresh_needed' | 'setup_required';
  setupType: 'default' | 'advanced' | 'none';
}

export interface ScanSummary {
  repository: Repository;
  latestScan: {
    date: string;
    status: 'success' | 'failure';
    resultsCount: number;
    rulesCount: number;
    commitSha: string;
    scanType: 'default-setup' | 'advanced';
    toolVersion?: string;
  } | null;
  historicalTrend: Array<{
    date: string;
    resultsCount: number;
    commitSha: string;
  }>;
  sarifAvailable: boolean;
  recommendations: string[];
  setupType: 'default' | 'advanced' | 'none';
}

// Global scan freshness aggregation
export interface FreshnessBuckets {
  fresh24h: number; // scans within last 24h
  stale7d: number;  // scans >24h and <=7d
  old: number;      // scans >7d
  never: number;    // no scan recorded
}

export interface FreshnessSummary {
  total: number;
  buckets: FreshnessBuckets;
  freshnessScore: number; // 0-100 weighted score (recent scans contribute more)
  generated_at: string;
}

export type ExportFormat = 'pdf' | 'csv' | 'json' | 'xlsx';