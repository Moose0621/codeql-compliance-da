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
  // New filterable metadata for advanced search
  languages?: string[];
  topics?: string[];
  last_activity_date?: string;
  team_slug?: string;
  compliance_score?: number;
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

// GitHub API Response interfaces for proper typing
export interface Workflow {
  id: number;
  name: string;
  path: string;
  state: string;
}

export interface GitHubWorkflowsResponse {
  workflows: Workflow[];
}

export interface GitHubWorkflowRunsResponse {
  workflow_runs: GitHubWorkflowRun[];
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  path: string;
  status: string | null;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  default_branch: string;
  language: string | null;
  languages_url: string;
  topics: string[];
  updated_at: string;
  pushed_at: string;
}

export interface GitHubUserInfo {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
  email: string;
}

export interface GitHubOrganizationInfo {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
  description: string;
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

export interface ExecutiveSummaryReport {
  id: string;
  generated_at: string;
  generated_by: string;
  organization: string;
  report_period: {
    start_date: string;
    end_date: string;
  };
  executive_summary: {
    security_posture: 'excellent' | 'good' | 'needs_attention' | 'critical';
    total_repositories: number;
    scan_coverage_percent: number;
    critical_issues: number;
    high_issues: number;
    risk_score: number; // 0-100
    trending: 'improving' | 'stable' | 'declining';
  };
  key_metrics: {
    repositories_scanned_30d: number;
    median_scan_time_minutes: number;
    compliance_percentage: number;
    issues_resolved_30d: number;
  };
  recommendations: string[];
  compliance_status: {
    fedramp_compliant: boolean;
    areas_for_improvement: string[];
  };
}

export interface TechnicalDetailReport {
  id: string;
  generated_at: string;
  generated_by: string;
  organization: string;
  report_period: {
    start_date: string;
    end_date: string;
  };
  repository_findings: Array<{
    repository: Repository;
    scan_details: {
      last_scan_date: string;
      scan_status: 'success' | 'failure' | 'pending';
      duration_minutes: number;
      commit_sha: string;
      codeql_version: string;
    };
    findings_breakdown: SecurityFindings;
    top_vulnerabilities: Array<{
      rule_id: string;
      severity: 'critical' | 'high' | 'medium' | 'low' | 'note';
      title: string;
      description: string;
      locations_count: number;
      cwe_id?: string;
    }>;
    remediation_guidance: string[];
  }>;
  aggregate_metrics: {
    total_scan_time_hours: number;
    average_findings_per_repo: number;
    most_common_vulnerabilities: Array<{
      rule_id: string;
      occurrences: number;
      affected_repos: number;
    }>;
  };
}

export type ReportType = 'executive' | 'technical' | 'compliance';
export type ReportFormat = 'pdf' | 'html' | 'csv' | 'json';

// Advanced filtering interfaces
export interface FilterOptions {
  languages: string[];
  topics: string[];
  teams: string[];
  complianceScoreRange: [number, number];
  activityPeriod: '24h' | '7d' | '30d' | '3m' | '6m' | '1y' | 'all';
  lastScanAge: '1d' | '7d' | '30d' | '90d' | 'any';
}

export interface FilterState {
  search: string;
  severityFilter: string | null;
  showResultsOnly: boolean;
  advanced: Partial<FilterOptions>;
}

export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  filters: Partial<FilterState>;
  icon?: string;
}

export interface SearchQuery {
  text: string;
  operators: {
    and: string[];
    or: string[];
    not: string[];
  };
  fields: Record<string, string[]>;
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

export type ExportFormat = 'pdf' | 'html' | 'csv' | 'json' | 'xlsx';

// Real-time Webhook Integration Types
export interface GitHubWebhookEvent {
  action: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
      avatar_url: string;
    };
  };
  sender: {
    login: string;
    avatar_url: string;
  };
  installation?: {
    id: number;
  };
}

export interface WorkflowRunWebhookEvent extends GitHubWebhookEvent {
  action: 'requested' | 'in_progress' | 'completed';
  workflow_run: {
    id: number;
    name: string;
    status: 'requested' | 'in_progress' | 'queued' | 'completed';
    conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
    created_at: string;
    updated_at: string;
    html_url: string;
    run_number: number;
    workflow_id: number;
    head_commit: {
      id: string;
      message: string;
      author: {
        name: string;
        email: string;
      };
    };
  };
}

export interface CodeScanningAlertWebhookEvent extends GitHubWebhookEvent {
  action: 'created' | 'reopened' | 'closed_by_user' | 'fixed' | 'appeared_in_branch' | 'closed_by_user';
  alert: {
    number: number;
    created_at: string;
    updated_at: string;
    dismissed_at: string | null;
    dismissed_by: any | null;
    dismissed_reason: string | null;
    rule: {
      id: string;
      severity: 'error' | 'warning' | 'note';
      security_severity_level: 'critical' | 'high' | 'medium' | 'low' | null;
      description: string;
    };
    state: 'open' | 'dismissed' | 'fixed';
  };
}

export interface PushWebhookEvent extends GitHubWebhookEvent {
  ref: string;
  before: string;
  after: string;
  commits: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
    added: string[];
    removed: string[];
    modified: string[];
  }>;
  head_commit: {
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
  };
}

export interface SecurityAdvisoryWebhookEvent extends GitHubWebhookEvent {
  action: 'published' | 'updated' | 'withdrawn';
  security_advisory: {
    ghsa_id: string;
    cve_id: string | null;
    summary: string;
    description: string;
    severity: 'low' | 'moderate' | 'high' | 'critical';
    published_at: string;
    updated_at: string;
    withdrawn_at: string | null;
    vulnerabilities: Array<{
      package: {
        ecosystem: string;
        name: string;
      };
      severity: string;
      vulnerable_version_range: string;
      first_patched_version: {
        identifier: string;
      } | null;
    }>;
  };
}

export type WebhookEventType = 
  | 'workflow_run'
  | 'code_scanning_alert'  
  | 'push'
  | 'security_advisory'
  | 'pull_request'
  | 'repository';

export interface WebhookSignature {
  'x-github-delivery': string;
  'x-github-event': WebhookEventType;
  'x-hub-signature-256': string;
  'x-github-hook-id': string;
  'x-github-hook-installation-target-id': string;
  'x-github-hook-installation-target-type': string;
}

export interface WebSocketConnectionState {
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
  lastConnected: string | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  connectionId: string | null;
  latency: number | null;
}

export interface RealTimeEvent {
  id: string;
  type: 'repository_update' | 'scan_status' | 'security_alert' | 'webhook_received';
  timestamp: string;
  data: any;
  source: 'webhook' | 'polling' | 'user_action';
  repository?: string;
}

export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
  eventType?: WebhookEventType;
  deliveryId?: string;
}

export interface WebSocketMessage {
  type: 'event' | 'heartbeat' | 'error' | 'reconnect';
  payload?: RealTimeEvent | { error: string } | { status: string };
  timestamp: string;
}

// Connection Management
export interface ConnectionHealth {
  websocket: {
    connected: boolean;
    latency: number;
    lastHeartbeat: string;
    errors: number;
  };
  github: {
    rateLimit: {
      remaining: number;
      resetAt: string;
    };
    status: 'operational' | 'degraded' | 'major_outage';
  };
}