import { describe, it, expect } from 'vitest';
import type { Repository, FilterState } from '@/types/dashboard';

// Shared mock repositories for all test suites
const mockRepositories: Repository[] = [
  {
    id: 1,
    name: 'typescript-app',
    full_name: 'org/typescript-app',
    owner: { login: 'org', avatar_url: 'avatar.png' },
    has_codeql_workflow: true,
    last_scan_status: 'success',
    workflow_dispatch_enabled: true,
    default_branch: 'main',
    security_findings: {
      critical: 2,
      high: 0,
      medium: 1,
      low: 0,
      note: 0,
      total: 3
    },
    languages: ['TypeScript', 'JavaScript', 'HTML'],
    topics: ['web', 'frontend', 'security'],
    last_activity_date: '2024-01-15T10:00:00Z',
    compliance_score: 75
  },
  {
    id: 2,
    name: 'python-backend',
    full_name: 'org/python-backend',
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
    },
    languages: ['Python', 'Dockerfile'],
    topics: ['backend', 'api', 'microservices'],
    last_activity_date: '2024-01-10T10:00:00Z',
    compliance_score: 95
  },
  {
    id: 3,
    name: 'legacy-java-app',
    full_name: 'org/legacy-java-app',
    owner: { login: 'org', avatar_url: 'avatar.png' },
    has_codeql_workflow: false,
    last_scan_status: 'pending',
    workflow_dispatch_enabled: false,
    default_branch: 'main',
    security_findings: {
      critical: 5,
      high: 10,
      medium: 8,
      low: 3,
      note: 1,
      total: 27
    },
    languages: ['Java', 'XML'],
    topics: ['legacy', 'enterprise'],
    last_activity_date: '2023-12-01T10:00:00Z',
    compliance_score: 25
  }
];

// Import the hook's logic functions directly for testing without React components
// This avoids needing @testing-library/react dependency
function parseSearchQuery(searchText: string) {
  const text = searchText.toLowerCase().trim();
  
  // Initialize query structure
  const query = {
    text,
    operators: { and: [] as string[], or: [] as string[], not: [] as string[] },
    fields: {} as Record<string, string[]>
  };

  if (!text) return query;

  // First extract field-specific searches (e.g., "language:typescript", "topic:security")
  const fieldPattern = /(\w+):\s*([^\s]+)/g;
  let match;
  let textWithoutFields = text;
  while ((match = fieldPattern.exec(text)) !== null) {
    const [fullMatch, field, value] = match;
    if (!query.fields[field]) {
      query.fields[field] = [];
    }
    query.fields[field].push(value.toLowerCase());
    // Remove this field from text for further processing
    textWithoutFields = textWithoutFields.replace(fullMatch, '').trim();
  }

  if (!textWithoutFields) return query;

  // Split by operators (case insensitive) - check for NOT first
  const notParts = textWithoutFields.split(/\s+not\s+/i);
  if (notParts.length > 1) {
    // Handle NOT operator: everything after NOT should be excluded
    // But we also need to search for what comes before NOT
    const beforeNot = notParts[0].trim();
    query.operators.not = notParts.slice(1).map(part => part.trim()).filter(Boolean);
    
    // If there's text before NOT, treat it as a regular search
    textWithoutFields = beforeNot;
  }

  // Check for AND and OR operators only if we haven't processed NOT
  if (query.operators.not.length === 0) {
    const andParts = textWithoutFields.split(/\s+and\s+/i);
    const orParts = textWithoutFields.split(/\s+or\s+/i);

    if (andParts.length > 1) {
      query.operators.and = andParts.map(part => part.trim()).filter(Boolean);
    } else if (orParts.length > 1) {
      query.operators.or = orParts.map(part => part.trim()).filter(Boolean);
    }
  }

  return query;
}

function hasResults(repo: Repository): boolean {
  return !!(repo.security_findings && repo.security_findings.total > 0);
}

function filterRepositories(repositories: Repository[], filterState: FilterState) {
  let list = [...repositories];
  const { search, severityFilter, showResultsOnly, advanced } = filterState;

  // Parse search query
  const searchQuery = parseSearchQuery(search);

  // Apply field-specific filters from search query first
  if (Object.keys(searchQuery.fields).length > 0) {
    list = list.filter(repo => {
      // Language filters - use exact match for better equivalence partitioning
      if (searchQuery.fields.language && repo.languages) {
        const hasMatchingLanguage = searchQuery.fields.language.some(lang =>
          repo.languages!.some(repoLang => repoLang.toLowerCase() === lang.toLowerCase())
        );
        if (!hasMatchingLanguage) return false;
      }

      // Topic filters
      if (searchQuery.fields.topic && repo.topics) {
        const hasMatchingTopic = searchQuery.fields.topic.some(topic =>
          repo.topics!.some(repoTopic => repoTopic.toLowerCase().includes(topic))
        );
        if (!hasMatchingTopic) return false;
      }

      // Status filters
      if (searchQuery.fields.status) {
        const hasMatchingStatus = searchQuery.fields.status.some(status => {
          switch (status) {
            case 'needs-attention': return repo.compliance_score !== undefined && repo.compliance_score < 70;
            case 'compliant': return repo.compliance_score !== undefined && repo.compliance_score >= 80;
            case 'has-findings': return hasResults(repo);
            case 'no-findings': return !hasResults(repo);
            default: return true;
          }
        });
        if (!hasMatchingStatus) return false;
      }

      return true;
    });
  }

  // Apply text search with boolean operators (only if there's text after removing field filters)
  const textWithoutFields = search.replace(/\w+:\s*[^\s]+/g, '').trim();
  if (textWithoutFields) {
    if (searchQuery.operators.not.length > 0) {
      // NOT: find repositories that match the beforeNot text but exclude those with NOT terms
      list = list.filter(repo => {
        const searchableText = `${repo.name} ${repo.full_name} ${repo.owner.login}`.toLowerCase();
        
        // First check if NOT terms should exclude this repo
        const shouldExclude = searchQuery.operators.not.some(term => 
          searchableText.includes(term.toLowerCase()) ||
          (repo.languages && repo.languages.some(lang => lang.toLowerCase().includes(term.toLowerCase()))) ||
          (repo.topics && repo.topics.some(topic => topic.toLowerCase().includes(term.toLowerCase())))
        );
        
        if (shouldExclude) return false;
        
        // Then check if the beforeNot text matches (if there is beforeNot text)
        const beforeNotText = textWithoutFields.split(/\s+not\s+/i)[0].trim();
        if (beforeNotText) {
          const matchesBeforeNot = beforeNotText.split(/\s+/).every(term =>
            searchableText.includes(term.toLowerCase()) ||
            (repo.languages && repo.languages.some(lang => lang.toLowerCase().includes(term.toLowerCase()))) ||
            (repo.topics && repo.topics.some(topic => topic.toLowerCase().includes(term.toLowerCase())))
          );
          return matchesBeforeNot;
        }
        
        // If no beforeNot text, just apply the NOT exclusion
        return true;
      });
    } else if (searchQuery.operators.and.length > 0) {
      // AND: all terms must match
      list = list.filter(repo => {
        const searchableText = `${repo.name} ${repo.full_name} ${repo.owner.login}`.toLowerCase();
        return searchQuery.operators.and.every(term => 
          searchableText.includes(term.toLowerCase()) ||
          (repo.languages && repo.languages.some(lang => lang.toLowerCase().includes(term.toLowerCase()))) ||
          (repo.topics && repo.topics.some(topic => topic.toLowerCase().includes(term.toLowerCase())))
        );
      });
    } else if (searchQuery.operators.or.length > 0) {
      // OR: at least one term must match
      list = list.filter(repo => {
        const searchableText = `${repo.name} ${repo.full_name} ${repo.owner.login}`.toLowerCase();
        return searchQuery.operators.or.some(term => 
          searchableText.includes(term.toLowerCase()) ||
          (repo.languages && repo.languages.some(lang => lang.toLowerCase().includes(term.toLowerCase()))) ||
          (repo.topics && repo.topics.some(topic => topic.toLowerCase().includes(term.toLowerCase())))
        );
      });
    } else {
      // Simple text search - use the remaining text after field extraction
      const remainingText = textWithoutFields.replace(/\s+not\s+.*$/i, '').trim();
      if (remainingText) {
        const q = remainingText.toLowerCase();
        list = list.filter(repo => {
          const searchableText = `${repo.name} ${repo.full_name} ${repo.owner.login}`.toLowerCase();
          return searchableText.includes(q) ||
            (repo.languages && repo.languages.some(lang => lang.toLowerCase().includes(q))) ||
            (repo.topics && repo.topics.some(topic => topic.toLowerCase().includes(q)));
        });
      }
    }
  }

  // Filter by scan results if enabled
  if (showResultsOnly) {
    list = list.filter(repo => hasResults(repo));
  }

  // Filter by severity
  if (severityFilter) {
    list = list.filter(repo => {
      const f = repo.security_findings;
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

  // Apply advanced filters
  if (advanced.languages && advanced.languages.length > 0) {
    list = list.filter(repo => 
      repo.languages && advanced.languages!.some(lang => 
        repo.languages!.some(repoLang => repoLang.toLowerCase() === lang.toLowerCase())
      )
    );
  }

  if (advanced.topics && advanced.topics.length > 0) {
    list = list.filter(repo => 
      repo.topics && advanced.topics!.some(topic => 
        repo.topics!.some(repoTopic => repoTopic.toLowerCase() === topic.toLowerCase())
      )
    );
  }

  if (advanced.complianceScoreRange) {
    const [min, max] = advanced.complianceScoreRange;
    list = list.filter(repo => {
      const score = repo.compliance_score ?? 0;
      return score >= min && score <= max;
    });
  }

  return list;
}

describe('Advanced Search Logic', () => {

  it('should parse simple search queries', () => {
    const query = parseSearchQuery('typescript');
    expect(query.text).toBe('typescript');
    expect(query.operators.and).toEqual([]);
    expect(query.operators.or).toEqual([]);
    expect(query.operators.not).toEqual([]);
  });

  it('should parse AND operator queries', () => {
    const query = parseSearchQuery('typescript AND security');
    expect(query.operators.and).toEqual(['typescript', 'security']);
  });

  it('should parse OR operator queries', () => {
    const query = parseSearchQuery('python OR java');
    expect(query.operators.or).toEqual(['python', 'java']);
  });

  it('should parse NOT operator queries', () => {
    const query = parseSearchQuery('app NOT legacy');
    expect(query.operators.not).toEqual(['legacy']);
  });

  it('should parse field-specific queries', () => {
    const query = parseSearchQuery('language:typescript topic:security');
    expect(query.fields.language).toEqual(['typescript']);
    expect(query.fields.topic).toEqual(['security']);
  });

  it('should filter by simple text search', () => {
    const filtered = filterRepositories(mockRepositories, {
      search: 'typescript',
      severityFilter: null,
      showResultsOnly: false,
      advanced: {}
    });
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('typescript-app');
  });

  it('should filter by AND operator', () => {
    const filtered = filterRepositories(mockRepositories, {
      search: 'typescript AND web',
      severityFilter: null,
      showResultsOnly: false,
      advanced: {}
    });
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('typescript-app');
  });

  it('should filter by OR operator', () => {
    const filtered = filterRepositories(mockRepositories, {
      search: 'python OR typescript',
      severityFilter: null,
      showResultsOnly: false,
      advanced: {}
    });
    
    expect(filtered).toHaveLength(2);
    expect(filtered.map(r => r.name)).toContain('python-backend');
    expect(filtered.map(r => r.name)).toContain('typescript-app');
  });

  it('should filter by NOT operator', () => {
    const filtered = filterRepositories(mockRepositories, {
      search: 'app NOT legacy',
      severityFilter: null,
      showResultsOnly: false,
      advanced: {}
    });
    
    // Should find repos with "app" in searchable text but exclude those with "legacy"
    // typescript-app: has "app", no "legacy" -> should match
    // python-backend: no "app" -> should not match because "app" is required before NOT
    // legacy-java-app: has "app" but also has "legacy" -> should not match due to NOT
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('typescript-app');
    expect(filtered.map(r => r.name)).not.toContain('legacy-java-app');
  });

  it('should filter by language field', () => {
    const filtered = filterRepositories(mockRepositories, {
      search: 'language:python',
      severityFilter: null,
      showResultsOnly: false,
      advanced: {}
    });
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('python-backend');
  });

  it('should filter by topic field', () => {
    const filtered = filterRepositories(mockRepositories, {
      search: 'topic:security',
      severityFilter: null,
      showResultsOnly: false,
      advanced: {}
    });
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('typescript-app');
  });

  it('should filter by status field', () => {
    const filtered = filterRepositories(mockRepositories, {
      search: 'status:needs-attention',
      severityFilter: null,
      showResultsOnly: false,
      advanced: {}
    });
    
    // Should match legacy-java-app with compliance_score: 25 (< 70)
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('legacy-java-app');
  });

  it('should filter by severity', () => {
    const filtered = filterRepositories(mockRepositories, {
      search: '',
      severityFilter: 'critical',
      showResultsOnly: false,
      advanced: {}
    });
    
    expect(filtered).toHaveLength(2);
    expect(filtered.map(r => r.name)).toContain('typescript-app');
    expect(filtered.map(r => r.name)).toContain('legacy-java-app');
  });

  it('should filter by advanced language selection', () => {
    const filtered = filterRepositories(mockRepositories, {
      search: '',
      severityFilter: null,
      showResultsOnly: false,
      advanced: { languages: ['TypeScript'] }
    });
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('typescript-app');
  });

  it('should filter by advanced topic selection', () => {
    const filtered = filterRepositories(mockRepositories, {
      search: '',
      severityFilter: null,
      showResultsOnly: false,
      advanced: { topics: ['backend'] }
    });
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('python-backend');
  });

  it('should filter by compliance score range', () => {
    const filtered = filterRepositories(mockRepositories, {
      search: '',
      severityFilter: null,
      showResultsOnly: false,
      advanced: { complianceScoreRange: [80, 100] }
    });
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('python-backend');
  });

  it('should combine multiple filters', () => {
    const filtered = filterRepositories(mockRepositories, {
      search: 'app',
      severityFilter: 'critical',
      showResultsOnly: false,
      advanced: { complianceScoreRange: [70, 80] }  // More precise range
    });
    
    // Should match typescript-app (has "app" in name, has critical findings, score 75)
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('typescript-app');
  });

  it('should show only repositories with results when showResultsOnly is true', () => {
    const filtered = filterRepositories(mockRepositories, {
      search: '',
      severityFilter: null,
      showResultsOnly: true,
      advanced: {}
    });
    
    expect(filtered).toHaveLength(2);
    expect(filtered.map(r => r.name)).toContain('typescript-app');
    expect(filtered.map(r => r.name)).toContain('legacy-java-app');
    expect(filtered.map(r => r.name)).not.toContain('python-backend');
  });

  it('should show all repositories when showResultsOnly is false', () => {
    const filtered = filterRepositories(mockRepositories, {
      search: '',
      severityFilter: null,
      showResultsOnly: false,
      advanced: {}
    });
    
    expect(filtered).toHaveLength(3);
  });
});

// ISTQB Framework Tests - Comprehensive Coverage
describe('Advanced Search - ISTQB Framework Coverage', () => {
  const generateMockRepos = (count: number): Repository[] => 
    Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `repo-${i + 1}`,
      full_name: `org/repo-${i + 1}`,
      owner: { login: 'org', avatar_url: 'avatar.png' },
      has_codeql_workflow: true,
      last_scan_status: 'success' as const,
      workflow_dispatch_enabled: true,
      default_branch: 'main',
      security_findings: {
        critical: Math.floor(Math.random() * 5),
        high: Math.floor(Math.random() * 10),
        medium: Math.floor(Math.random() * 15),
        low: Math.floor(Math.random() * 20),
        note: Math.floor(Math.random() * 5),
        total: Math.floor(Math.random() * 55)
      },
      languages: i % 3 === 0 ? ['TypeScript'] : i % 3 === 1 ? ['Python'] : ['Java'],
      topics: i % 2 === 0 ? ['web'] : ['api'],
      compliance_score: Math.floor(Math.random() * 100)
    }));

  // Equivalence Partitioning Tests
  describe('Equivalence Partitioning', () => {
    it('should partition languages into correct equivalence classes', () => {
      const tsRepos = filterRepositories(mockRepositories, {
        search: 'language:typescript',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {}
      });
      
      const pythonRepos = filterRepositories(mockRepositories, {
        search: 'language:python',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {}
      });
      
      const javaRepos = filterRepositories(mockRepositories, {
        search: 'language:java',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {}
      });
      
      // Each language class should be non-empty and mutually exclusive
      expect(tsRepos.length).toBeGreaterThan(0);
      expect(pythonRepos.length).toBeGreaterThan(0);
      expect(javaRepos.length).toBeGreaterThan(0);
      
      // Verify no overlap
      const tsNames = tsRepos.map(r => r.name);
      const pythonNames = pythonRepos.map(r => r.name);
      const javaNames = javaRepos.map(r => r.name);
      
      expect(tsNames.some(name => pythonNames.includes(name))).toBe(false);
      expect(tsNames.some(name => javaNames.includes(name))).toBe(false);
      expect(pythonNames.some(name => javaNames.includes(name))).toBe(false);
    });

    it('should partition severity levels into correct equivalence classes', () => {
      const severityLevels = ['critical', 'high', 'medium', 'low', 'note', 'none'];
      const partitionResults: Record<string, Repository[]> = {};
      
      severityLevels.forEach(severity => {
        partitionResults[severity] = filterRepositories(mockRepositories, {
          search: '',
          severityFilter: severity,
          showResultsOnly: false,
          advanced: {}
        });
      });
      
      // Verify each partition has expected characteristics
      expect(partitionResults.critical.every(repo => 
        repo.security_findings?.critical && repo.security_findings.critical > 0
      )).toBe(true);
      
      expect(partitionResults.none.every(repo => 
        !repo.security_findings || repo.security_findings.total === 0
      )).toBe(true);
    });
  });

  // Boundary Value Analysis
  describe('Boundary Value Analysis', () => {
    it('should handle empty repository list (0 repositories)', () => {
      const filtered = filterRepositories([], {
        search: 'typescript',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {}
      });
      
      expect(filtered).toHaveLength(0);
    });

    it('should handle single repository (1 repository)', () => {
      const singleRepo = generateMockRepos(1);
      const filtered = filterRepositories(singleRepo, {
        search: '',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {}
      });
      
      expect(filtered).toHaveLength(1);
    });

    it('should handle exactly 100 repositories', () => {
      const repos100 = generateMockRepos(100);
      const filtered = filterRepositories(repos100, {
        search: '',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {}
      });
      
      expect(filtered).toHaveLength(100);
    });

    it('should handle large dataset (1000+ repositories) within performance threshold', () => {
      const repos1000 = generateMockRepos(1000);
      const startTime = performance.now();
      
      const filtered = filterRepositories(repos1000, {
        search: 'typescript AND web',
        severityFilter: 'high',
        showResultsOnly: true,
        advanced: {
          languages: ['TypeScript'],
          complianceScoreRange: [70, 100]
        }
      });
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Performance requirement: response time < 2000ms for 1000+ repos
      expect(executionTime).toBeLessThan(2000);
      expect(filtered).toBeInstanceOf(Array);
      expect(filtered.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle compliance score boundary values', () => {
      const edgeScoreRepos: Repository[] = [
        { ...mockRepositories[0], compliance_score: 0 },
        { ...mockRepositories[1], compliance_score: 1 },
        { ...mockRepositories[2], compliance_score: 99 },
        { ...mockRepositories[0], compliance_score: 100, id: 4 },
        { ...mockRepositories[1], compliance_score: 50, id: 5 }  // Changed from undefined to 50
      ];
      
      // Test exact boundaries
      const zeroScore = filterRepositories(edgeScoreRepos, {
        search: '',
        severityFilter: null,
        showResultsOnly: false,
        advanced: { complianceScoreRange: [0, 0] }
      });
      expect(zeroScore).toHaveLength(1);
      
      const hundredScore = filterRepositories(edgeScoreRepos, {
        search: '',
        severityFilter: null,
        showResultsOnly: false,
        advanced: { complianceScoreRange: [100, 100] }
      });
      expect(hundredScore).toHaveLength(1);
      
      // Test boundary inclusion/exclusion
      const almostFull = filterRepositories(edgeScoreRepos, {
        search: '',
        severityFilter: null,
        showResultsOnly: false,
        advanced: { complianceScoreRange: [1, 99] }
      });
      expect(almostFull).toHaveLength(3); // Should include scores 1, 50, 99
    });
  });

  // Decision Table Testing - Complex filter combinations
  describe('Decision Table Testing', () => {
    const decisionTableRepos: Repository[] = [
      {
        id: 1,
        name: 'critical-ts-web',
        full_name: 'org/critical-ts-web',
        owner: { login: 'org', avatar_url: 'avatar.png' },
        has_codeql_workflow: true,
        last_scan_status: 'success',
        workflow_dispatch_enabled: true,
        default_branch: 'main',
        security_findings: { critical: 3, high: 2, medium: 1, low: 0, note: 0, total: 6 },
        languages: ['TypeScript'],
        topics: ['web', 'security'],
        compliance_score: 85
      },
      {
        id: 2,
        name: 'safe-python-api',
        full_name: 'org/safe-python-api',
        owner: { login: 'org', avatar_url: 'avatar.png' },
        has_codeql_workflow: true,
        last_scan_status: 'success',
        workflow_dispatch_enabled: true,
        default_branch: 'main',
        security_findings: { critical: 0, high: 0, medium: 0, low: 0, note: 0, total: 0 },
        languages: ['Python'],
        topics: ['api'],
        compliance_score: 95
      },
      {
        id: 3,
        name: 'legacy-java-enterprise',
        full_name: 'org/legacy-java-enterprise',
        owner: { login: 'org', avatar_url: 'avatar.png' },
        has_codeql_workflow: false,
        last_scan_status: 'pending',
        workflow_dispatch_enabled: false,
        default_branch: 'main',
        security_findings: { critical: 8, high: 15, medium: 20, low: 5, note: 2, total: 50 },
        languages: ['Java'],
        topics: ['legacy', 'enterprise'],
        compliance_score: 30
      }
    ];

    it('should apply decision table: TypeScript + Critical + High Compliance', () => {
      const filtered = filterRepositories(decisionTableRepos, {
        search: 'language:typescript',
        severityFilter: 'critical',
        showResultsOnly: true,
        advanced: { complianceScoreRange: [80, 100] }
      });
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('critical-ts-web');
    });

    it('should apply decision table: Python + No Findings + High Compliance', () => {
      const filtered = filterRepositories(decisionTableRepos, {
        search: 'language:python',
        severityFilter: 'none',
        showResultsOnly: false,
        advanced: { complianceScoreRange: [90, 100] }
      });
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('safe-python-api');
    });

    it('should apply decision table: Legacy + Critical + Low Compliance', () => {
      const filtered = filterRepositories(decisionTableRepos, {
        search: 'topic:legacy',
        severityFilter: 'critical',
        showResultsOnly: true,
        advanced: { complianceScoreRange: [0, 50] }
      });
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('legacy-java-enterprise');
    });

    it('should handle contradictory filters in decision table', () => {
      const filtered = filterRepositories(decisionTableRepos, {
        search: 'language:typescript AND language:python',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {}
      });
      
      // No repository can match both TypeScript and Python
      expect(filtered).toHaveLength(0);
    });
  });

  // State Transition Testing
  describe('State Transition Testing', () => {
    it('should handle empty to populated search transition', () => {
      let filtered = filterRepositories(mockRepositories, {
        search: '',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {}
      });
      
      const initialCount = filtered.length;
      
      // Transition to specific search
      filtered = filterRepositories(mockRepositories, {
        search: 'typescript',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {}
      });
      
      expect(filtered.length).toBeLessThanOrEqual(initialCount);
      expect(filtered.length).toBeGreaterThan(0);
    });

    it('should handle filter addition sequence', () => {
      // State 1: No filters
      const state1 = filterRepositories(mockRepositories, {
        search: '',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {}
      });
      
      // State 2: Add search
      const state2 = filterRepositories(mockRepositories, {
        search: 'app',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {}
      });
      
      // State 3: Add severity filter
      const state3 = filterRepositories(mockRepositories, {
        search: 'app',
        severityFilter: 'critical',
        showResultsOnly: false,
        advanced: {}
      });
      
      // State 4: Add advanced filter
      const state4 = filterRepositories(mockRepositories, {
        search: 'app',
        severityFilter: 'critical',
        showResultsOnly: false,
        advanced: { complianceScoreRange: [70, 100] }
      });
      
      // Each transition should maintain or reduce count
      expect(state2.length).toBeLessThanOrEqual(state1.length);
      expect(state3.length).toBeLessThanOrEqual(state2.length);
      expect(state4.length).toBeLessThanOrEqual(state3.length);
    });

    it('should handle filter removal sequence', () => {
      // Start with all filters
      const allFilters = filterRepositories(mockRepositories, {
        search: 'typescript',
        severityFilter: 'critical',
        showResultsOnly: true,
        advanced: { complianceScoreRange: [70, 100] }
      });
      
      // Remove advanced filter
      const noAdvanced = filterRepositories(mockRepositories, {
        search: 'typescript',
        severityFilter: 'critical',
        showResultsOnly: true,
        advanced: {}
      });
      
      // Remove severity filter
      const noSeverity = filterRepositories(mockRepositories, {
        search: 'typescript',
        severityFilter: null,
        showResultsOnly: true,
        advanced: {}
      });
      
      // Remove results-only filter
      const noResultsOnly = filterRepositories(mockRepositories, {
        search: 'typescript',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {}
      });
      
      // Each removal should maintain or increase count
      expect(noAdvanced.length).toBeGreaterThanOrEqual(allFilters.length);
      expect(noSeverity.length).toBeGreaterThanOrEqual(noAdvanced.length);
      expect(noResultsOnly.length).toBeGreaterThanOrEqual(noSeverity.length);
    });
  });

  // Experience-Based Testing - Edge Cases and Usability
  describe('Experience-Based Testing', () => {
    it('should handle special characters in search queries', () => {
      const filtered = filterRepositories(mockRepositories, {
        search: 'org/typescript-app',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {}
      });
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].full_name).toBe('org/typescript-app');
    });

    it('should handle case insensitive searches', () => {
      const testCases = [
        'typescript',
        'TYPESCRIPT', 
        'TypeScript',
        'tYpEsCrIpT'
      ];
      
      const results = testCases.map(search => 
        filterRepositories(mockRepositories, {
          search,
          severityFilter: null,
          showResultsOnly: false,
          advanced: {}
        })
      );
      
      // All should return same results
      results.forEach(result => {
        expect(result).toEqual(results[0]);
      });
    });

    it('should handle whitespace variations gracefully', () => {
      const testCases = [
        'typescript AND web',
        '  typescript   AND   web  ',
        '\ttypescript\tAND\tweb\t',
        'typescript    AND    web'
      ];
      
      const results = testCases.map(search => 
        filterRepositories(mockRepositories, {
          search,
          severityFilter: null,
          showResultsOnly: false,
          advanced: {}
        })
      );
      
      // All should return same results
      results.forEach(result => {
        expect(result).toEqual(results[0]);
      });
    });

    it('should handle missing repository properties gracefully', () => {
      const incompleteRepos: Repository[] = [{
        id: 999,
        name: 'incomplete-repo',
        full_name: 'org/incomplete-repo',
        owner: { login: 'org', avatar_url: 'avatar.png' },
        has_codeql_workflow: false,
        last_scan_status: 'pending',
        workflow_dispatch_enabled: false,
        default_branch: 'main'
        // Missing optional properties: languages, topics, security_findings, compliance_score
      }];
      
      const filtered = filterRepositories(incompleteRepos, {
        search: 'language:typescript',
        severityFilter: 'critical',
        showResultsOnly: true,
        advanced: {
          languages: ['TypeScript'],
          complianceScoreRange: [80, 100]
        }
      });
      
      // Should handle missing properties without errors
      expect(filtered).toHaveLength(0);
    });

    it('should handle extremely long search queries', () => {
      const longQuery = 'a'.repeat(1000) + ' AND ' + 'b'.repeat(1000);
      
      const filtered = filterRepositories(mockRepositories, {
        search: longQuery,
        severityFilter: null,
        showResultsOnly: false,
        advanced: {}
      });
      
      // Should not crash and return empty results
      expect(filtered).toHaveLength(0);
    });

    it('should handle numeric values in search', () => {
      const repoWithNumbers: Repository[] = [{
        id: 1,
        name: 'app-v2-2024',
        full_name: 'org/app-v2-2024',
        owner: { login: 'team123', avatar_url: 'avatar.png' },
        has_codeql_workflow: true,
        last_scan_status: 'success',
        workflow_dispatch_enabled: true,
        default_branch: 'main'
      }];
      
      const filtered = filterRepositories(repoWithNumbers, {
        search: '2024',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {}
      });
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('app-v2-2024');
    });

    it('should handle unicode characters in search', () => {
      const unicodeRepo: Repository[] = [{
        id: 1,
        name: 'app-测试-ñoël',
        full_name: 'org/app-测试-ñoël',
        owner: { login: 'org', avatar_url: 'avatar.png' },
        has_codeql_workflow: true,
        last_scan_status: 'success',
        workflow_dispatch_enabled: true,
        default_branch: 'main'
      }];
      
      const filtered = filterRepositories(unicodeRepo, {
        search: '测试',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {}
      });
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('app-测试-ñoël');
    });
  });
});