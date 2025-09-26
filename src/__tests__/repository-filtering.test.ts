import { describe, it, expect } from 'vitest';
import type { Repository } from '@/types/dashboard';

// Helper function to determine if repository has scan results
// This mirrors the hasResults function in App.tsx
const hasResults = (repo: Repository): boolean => {
  return !!(repo.security_findings && repo.security_findings.total > 0);
};

// Helper function to apply repository filtering
// This mirrors the filteredRepositories logic in App.tsx  
const filterRepositories = (
  repositories: Repository[],
  search: string,
  severityFilter: string | null,
  showResultsOnly: boolean
): Repository[] => {
  let list = repositories;
  
  // Filter by search term
  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter(r => r.name.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q));
  }
  
  // Filter by scan results if enabled
  if (showResultsOnly) {
    list = list.filter(r => hasResults(r));
  }
  
  // Filter by severity
  if (severityFilter) {
    list = list.filter(r => {
      const f = r.security_findings;
      if (!f) return severityFilter === 'none';
      switch (severityFilter) {
        case 'critical': return f.critical > 0;
        case 'high': return f.high > 0;
        case 'medium': return f.medium > 0;
        case 'low': return f.low > 0;
        case 'note': return f.note > 0;
        case 'none': return f.total === 0;
        default: return true;
      }
    });
  }
  return list;
};

describe('Repository Filtering', () => {
  const mockRepositories: Repository[] = [
    {
      id: 1,
      name: 'repo-with-findings',
      full_name: 'org/repo-with-findings', 
      owner: { login: 'org', avatar_url: 'avatar.png' },
      has_codeql_workflow: true,
      last_scan_status: 'success',
      workflow_dispatch_enabled: true,
      default_branch: 'main',
      security_findings: {
        critical: 2,
        high: 5,
        medium: 3,
        low: 1,
        note: 0,
        total: 11
      }
    },
    {
      id: 2,
      name: 'repo-without-findings',
      full_name: 'org/repo-without-findings',
      owner: { login: 'org', avatar_url: 'avatar.png' },
      has_codeql_workflow: true,
      last_scan_status: 'success', 
      workflow_dispatch_enabled: true,
      default_branch: 'main',
      security_findings: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        note: 0,
        total: 0
      }
    },
    {
      id: 3,
      name: 'repo-no-scan',
      full_name: 'org/repo-no-scan',
      owner: { login: 'org', avatar_url: 'avatar.png' },
      has_codeql_workflow: false,
      last_scan_status: 'pending',
      workflow_dispatch_enabled: false,
      default_branch: 'main'
      // No security_findings property
    }
  ];

  describe('hasResults function', () => {
    it('returns true for repository with findings', () => {
      expect(hasResults(mockRepositories[0])).toBe(true);
    });

    it('returns false for repository with zero findings', () => {
      expect(hasResults(mockRepositories[1])).toBe(false);
    });

    it('returns false for repository without security_findings', () => {
      expect(hasResults(mockRepositories[2])).toBe(false);
    });
  });

  describe('Results-only filtering', () => {
    it('shows only repositories with results when showResultsOnly is true', () => {
      const filtered = filterRepositories(mockRepositories, '', null, true);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });

    it('shows all repositories when showResultsOnly is false', () => {
      const filtered = filterRepositories(mockRepositories, '', null, false);
      expect(filtered).toHaveLength(3);
    });
  });

  describe('Combined filtering', () => {
    it('applies results filter with search filter', () => {
      const filtered = filterRepositories(mockRepositories, 'with-findings', null, true);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('repo-with-findings');
    });

    it('applies results filter with severity filter', () => {
      const filtered = filterRepositories(mockRepositories, '', 'critical', true);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('repo-with-findings');
    });

    it('returns empty when combining filters that exclude all repos', () => {
      const filtered = filterRepositories(mockRepositories, 'nonexistent', null, true);
      expect(filtered).toHaveLength(0);
    });

    it('works with all filters combined', () => {
      const filtered = filterRepositories(mockRepositories, 'repo', 'critical', true);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('repo-with-findings');
    });
  });

  describe('Search filtering (existing functionality)', () => {
    it('filters by repository name', () => {
      const filtered = filterRepositories(mockRepositories, 'with-findings', null, false);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('repo-with-findings');
    });

    it('filters by full name', () => {
      const filtered = filterRepositories(mockRepositories, 'org/', null, false);
      expect(filtered).toHaveLength(3);
    });
  });

  describe('Severity filtering (existing functionality)', () => {
    it('filters by critical severity', () => {
      const filtered = filterRepositories(mockRepositories, '', 'critical', false);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('repo-with-findings');
    });

    it('filters by none severity', () => {
      const filtered = filterRepositories(mockRepositories, '', 'none', false);
      expect(filtered).toHaveLength(2); // repo-without-findings and repo-no-scan
    });
  });
});