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