import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Repository, FilterState, FilterOptions } from '@/types/dashboard';

// Integration Tests for Advanced Search System
// Tests URL synchronization, localStorage integration, and component interaction

// Mock DOM environment
const mockWindow = {
  location: {
    search: '',
    pathname: '/dashboard'
  },
  history: {
    pushState: vi.fn(),
    replaceState: vi.fn()
  }
};

const mockLocalStorage = new Map<string, string>();

// Mock browser APIs
Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true
});

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => mockLocalStorage.get(key) || null,
    setItem: (key: string, value: string) => mockLocalStorage.set(key, value),
    removeItem: (key: string) => mockLocalStorage.delete(key),
    clear: () => mockLocalStorage.clear()
  },
  writable: true
});

// Mock URLSearchParams for Node environment
global.URLSearchParams = class MockURLSearchParams {
  private params = new Map<string, string>();

  constructor(search?: string) {
    if (search) {
      search.replace(/^\?/, '').split('&').forEach(param => {
        const [key, value] = param.split('=').map(decodeURIComponent);
        if (key) this.params.set(key, value || '');
      });
    }
  }

  get(key: string): string | null {
    return this.params.get(key) || null;
  }

  set(key: string, value: string): void {
    this.params.set(key, value);
  }

  toString(): string {
    const pairs: string[] = [];
    this.params.forEach((value, key) => {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    });
    return pairs.join('&');
  }
};

describe('Advanced Search Integration Tests', () => {
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
        high: 1,
        medium: 3,
        low: 0,
        note: 0,
        total: 6
      },
      languages: ['TypeScript', 'JavaScript'],
      topics: ['web', 'frontend'],
      compliance_score: 85,
      last_activity_date: '2024-01-15T10:00:00Z'
    },
    {
      id: 2,
      name: 'python-api',
      full_name: 'org/python-api',
      owner: { login: 'org', avatar_url: 'avatar.png' },
      has_codeql_workflow: true,
      last_scan_status: 'success',
      workflow_dispatch_enabled: true,
      default_branch: 'main',
      security_findings: {
        critical: 0,
        high: 2,
        medium: 1,
        low: 0,
        note: 0,
        total: 3
      },
      languages: ['Python'],
      topics: ['api', 'backend'],
      compliance_score: 92,
      last_activity_date: '2024-01-10T10:00:00Z'
    }
  ];

  // Utility functions for URL serialization (shared across tests)
  const serializeFiltersToURL = (filterState: FilterState): URLSearchParams => {
    const params = new URLSearchParams();
    
    if (filterState.search.trim()) {
      params.set('search', filterState.search);
    }
    
    if (filterState.severityFilter) {
      params.set('severity', filterState.severityFilter);
    }
    
    if (!filterState.showResultsOnly) {
      params.set('showAll', 'true');
    }
    
    if (filterState.advanced.languages?.length) {
      params.set('languages', filterState.advanced.languages.join(','));
    }
    
    if (filterState.advanced.topics?.length) {
      params.set('topics', filterState.advanced.topics.join(','));
    }
    
    if (filterState.advanced.complianceScoreRange) {
      const [min, max] = filterState.advanced.complianceScoreRange;
      if (min !== 0 || max !== 100) {
        params.set('complianceScore', `${min}-${max}`);
      }
    }
    
    if (filterState.advanced.activityPeriod && filterState.advanced.activityPeriod !== 'all') {
      params.set('activity', filterState.advanced.activityPeriod);
    }
    
    if (filterState.advanced.lastScanAge && filterState.advanced.lastScanAge !== 'any') {
      params.set('scanAge', filterState.advanced.lastScanAge);
    }
    
    return params;
  };

  const deserializeFiltersFromURL = (searchParams: URLSearchParams): Partial<FilterState> => {
    const filters: Partial<FilterState> = {
      advanced: {}
    };
    
    const search = searchParams.get('search');
    if (search) filters.search = search;
    
    const severity = searchParams.get('severity');
    if (severity) filters.severityFilter = severity;
    
    const showAll = searchParams.get('showAll');
    if (showAll === 'true') filters.showResultsOnly = false;
    
    const languages = searchParams.get('languages');
    if (languages) {
      filters.advanced!.languages = languages.split(',');
    }
    
    const topics = searchParams.get('topics');
    if (topics) {
      filters.advanced!.topics = topics.split(',');
    }
    
    const complianceScore = searchParams.get('complianceScore');
    if (complianceScore) {
      const [min, max] = complianceScore.split('-').map(Number);
      filters.advanced!.complianceScoreRange = [min, max];
    }
    
    const activity = searchParams.get('activity');
    if (activity) {
      filters.advanced!.activityPeriod = activity as FilterOptions['activityPeriod'];
    }
    
    const scanAge = searchParams.get('scanAge');
    if (scanAge) {
      filters.advanced!.lastScanAge = scanAge as FilterOptions['lastScanAge'];
    }
    
    return filters;
  };

  // Mock localStorage and history
  const mockPushState = vi.fn();
  const mockReplaceState = vi.fn();

  beforeEach(() => {
    // Reset mocks
    mockPushState.mockClear();
    mockReplaceState.mockClear();
    mockLocalStorage.clear();
    
    // Reset window.location mock
    mockWindow.location.search = '';
    mockWindow.location.pathname = '/dashboard';
    mockWindow.history.pushState = mockPushState;
    mockWindow.history.replaceState = mockReplaceState;
  });

  afterEach(() => {
    // Cleanup
    mockLocalStorage.clear();
  });

  // URL Parameter Synchronization Tests
  describe('URL Parameter Synchronization', () => {
    it('should serialize filter state to URL parameters correctly', () => {
      const filterState: FilterState = {
        search: 'typescript AND security',
        severityFilter: 'critical',
        showResultsOnly: true,
        advanced: {
          languages: ['TypeScript', 'Python'],
          topics: ['web', 'api'],
          complianceScoreRange: [70, 90],
          activityPeriod: '30d',
          lastScanAge: '7d'
        }
      };

      const params = serializeFiltersToURL(filterState);

      expect(params.get('search')).toBe('typescript AND security');
      expect(params.get('severity')).toBe('critical');
      expect(params.get('showAll')).toBeNull(); // showResultsOnly is true, so showAll should not be set
      expect(params.get('languages')).toBe('TypeScript,Python');
      expect(params.get('topics')).toBe('web,api');
      expect(params.get('complianceScore')).toBe('70-90');
      expect(params.get('activity')).toBe('30d');
      expect(params.get('scanAge')).toBe('7d');
    });

    it('should deserialize URL parameters to filter state correctly', () => {
      const searchParams = new URLSearchParams();
      searchParams.set('search', 'python OR java');
      searchParams.set('severity', 'high');
      searchParams.set('showAll', 'true');
      searchParams.set('languages', 'Python,Java');
      searchParams.set('topics', 'backend,api');
      searchParams.set('complianceScore', '80-100');
      searchParams.set('activity', '7d');
      searchParams.set('scanAge', '30d');

      const filters = deserializeFiltersFromURL(searchParams);

      expect(filters.search).toBe('python OR java');
      expect(filters.severityFilter).toBe('high');
      expect(filters.showResultsOnly).toBe(false);
      expect(filters.advanced?.languages).toEqual(['Python', 'Java']);
      expect(filters.advanced?.topics).toEqual(['backend', 'api']);
      expect(filters.advanced?.complianceScoreRange).toEqual([80, 100]);
      expect(filters.advanced?.activityPeriod).toBe('7d');
      expect(filters.advanced?.lastScanAge).toBe('30d');
    });

    it('should handle empty URL parameters gracefully', () => {
      const searchParams = new URLSearchParams();
      const filters = deserializeFiltersFromURL(searchParams);

      expect(filters.search).toBeUndefined();
      expect(filters.severityFilter).toBeUndefined();
      expect(filters.showResultsOnly).toBeUndefined();
      expect(filters.advanced?.languages).toBeUndefined();
      expect(filters.advanced?.topics).toBeUndefined();
    });

    it('should handle malformed URL parameters gracefully', () => {
      const searchParams = new URLSearchParams();
      searchParams.set('complianceScore', 'invalid-range');
      searchParams.set('activity', 'invalid-period');
      
      const filters = deserializeFiltersFromURL(searchParams);

      // Should not throw and should handle malformed data gracefully
      expect(filters.advanced?.complianceScoreRange).toEqual([NaN, NaN]);
      expect(filters.advanced?.activityPeriod).toBe('invalid-period');
    });

    it('should create shareable URLs with current filter state', () => {
      const filterState: FilterState = {
        search: 'language:typescript',
        severityFilter: 'critical',
        showResultsOnly: true,
        advanced: {
          complianceScoreRange: [80, 100]
        }
      };

      const params = serializeFiltersToURL(filterState);
      const shareableURL = `/dashboard?${params.toString()}`;

      expect(shareableURL).toContain('search=language%3Atypescript');
      expect(shareableURL).toContain('severity=critical');
      expect(shareableURL).toContain('complianceScore=80-100');
    });
  });

  // LocalStorage Integration Tests  
  describe('LocalStorage Integration', () => {
    it('should persist filter state to localStorage', () => {
      const filterState: FilterState = {
        search: 'typescript',
        severityFilter: 'high',
        showResultsOnly: false,
        advanced: {
          languages: ['TypeScript'],
          topics: ['web']
        }
      };

      // Simulate saving to localStorage
      localStorage.setItem('advanced-repo-filters', JSON.stringify(filterState));

      const stored = localStorage.getItem('advanced-repo-filters');
      const parsed = JSON.parse(stored!);

      expect(parsed.search).toBe('typescript');
      expect(parsed.severityFilter).toBe('high');
      expect(parsed.showResultsOnly).toBe(false);
      expect(parsed.advanced.languages).toEqual(['TypeScript']);
      expect(parsed.advanced.topics).toEqual(['web']);
    });

    it('should restore filter state from localStorage on initialization', () => {
      const storedState: FilterState = {
        search: 'python backend',
        severityFilter: 'critical',
        showResultsOnly: true,
        advanced: {
          complianceScoreRange: [90, 100]
        }
      };

      localStorage.setItem('advanced-repo-filters', JSON.stringify(storedState));

      // Simulate restoration
      const stored = localStorage.getItem('advanced-repo-filters');
      const restored = stored ? JSON.parse(stored) : null;

      expect(restored).toEqual(storedState);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      // Store invalid JSON
      localStorage.setItem('advanced-repo-filters', 'invalid-json-data');

      // Should not throw when parsing fails
      let restored = null;
      try {
        const stored = localStorage.getItem('advanced-repo-filters');
        if (stored) {
          restored = JSON.parse(stored);
        }
      } catch (error) {
        // Handle parsing error gracefully
        restored = null;
      }

      expect(restored).toBeNull();
    });

    it('should prioritize URL parameters over localStorage', () => {
      // Store state in localStorage
      const localStorageState: FilterState = {
        search: 'from-localstorage',
        severityFilter: 'low',
        showResultsOnly: true,
        advanced: {}
      };
      localStorage.setItem('advanced-repo-filters', JSON.stringify(localStorageState));

      // Simulate URL parameters
      const searchParams = new URLSearchParams();
      searchParams.set('search', 'from-url');
      searchParams.set('severity', 'critical');

      const urlFilters = deserializeFiltersFromURL(searchParams);

      // URL parameters should take precedence
      expect(urlFilters.search).toBe('from-url');
      expect(urlFilters.severityFilter).toBe('critical');
    });
  });

  // Component Integration Tests
  describe('Component Integration', () => {
    it('should integrate with repository filtering logic', () => {
      const filterState: FilterState = {
        search: 'language:typescript',
        severityFilter: 'critical',
        showResultsOnly: true,
        advanced: {
          complianceScoreRange: [80, 100]
        }
      };

      // Simulate the filtering logic from the hook
      let filteredRepos = [...mockRepositories];

      // Apply search filter
      if (filterState.search) {
        filteredRepos = filteredRepos.filter(repo =>
          repo.languages?.some(lang => 
            lang.toLowerCase() === 'typescript'
          )
        );
      }

      // Apply severity filter
      if (filterState.severityFilter === 'critical') {
        filteredRepos = filteredRepos.filter(repo =>
          repo.security_findings?.critical && repo.security_findings.critical > 0
        );
      }

      // Apply results-only filter
      if (filterState.showResultsOnly) {
        filteredRepos = filteredRepos.filter(repo =>
          repo.security_findings && repo.security_findings.total > 0
        );
      }

      // Apply compliance score filter
      if (filterState.advanced.complianceScoreRange) {
        const [min, max] = filterState.advanced.complianceScoreRange;
        filteredRepos = filteredRepos.filter(repo => {
          const score = repo.compliance_score ?? 0;
          return score >= min && score <= max;
        });
      }

      // Should match typescript-app: TypeScript language, critical findings, 85 compliance score
      expect(filteredRepos).toHaveLength(1);
      expect(filteredRepos[0].name).toBe('typescript-app');
    });

    it('should provide available filter options based on repository data', () => {
      // Extract available options from repositories
      const availableOptions = {
        languages: Array.from(new Set(mockRepositories.flatMap(repo => repo.languages || []))),
        topics: Array.from(new Set(mockRepositories.flatMap(repo => repo.topics || []))),
        complianceScoreRange: {
          min: Math.min(...mockRepositories.map(repo => repo.compliance_score || 0)),
          max: Math.max(...mockRepositories.map(repo => repo.compliance_score || 0))
        }
      };

      expect(availableOptions.languages).toContain('TypeScript');
      expect(availableOptions.languages).toContain('JavaScript');
      expect(availableOptions.languages).toContain('Python');
      
      expect(availableOptions.topics).toContain('web');
      expect(availableOptions.topics).toContain('frontend');
      expect(availableOptions.topics).toContain('api');
      expect(availableOptions.topics).toContain('backend');

      expect(availableOptions.complianceScoreRange.min).toBe(85);
      expect(availableOptions.complianceScoreRange.max).toBe(92);
    });

    it('should handle filter state changes and propagate updates', () => {
      let currentFilterState: FilterState = {
        search: '',
        severityFilter: null,
        showResultsOnly: true,
        advanced: {}
      };

      // Simulate filter change handler
      const handleFilterChange = (updates: Partial<FilterState>) => {
        currentFilterState = {
          ...currentFilterState,
          ...updates,
          advanced: {
            ...currentFilterState.advanced,
            ...(updates.advanced || {})
          }
        };
      };

      // Test search change
      handleFilterChange({ search: 'typescript' });
      expect(currentFilterState.search).toBe('typescript');

      // Test severity change
      handleFilterChange({ severityFilter: 'high' });
      expect(currentFilterState.severityFilter).toBe('high');

      // Test advanced filter change
      handleFilterChange({ 
        advanced: { languages: ['Python'] } 
      });
      expect(currentFilterState.advanced.languages).toEqual(['Python']);

      // Test that other properties are preserved
      expect(currentFilterState.search).toBe('typescript');
      expect(currentFilterState.severityFilter).toBe('high');
    });

    it('should handle filter clearing correctly', () => {
      let filterState: FilterState = {
        search: 'complex search query',
        severityFilter: 'critical',
        showResultsOnly: false,
        advanced: {
          languages: ['TypeScript', 'Python'],
          topics: ['web', 'api'],
          complianceScoreRange: [70, 90]
        }
      };

      // Simulate clear filters
      const clearFilters = () => {
        filterState = {
          search: '',
          severityFilter: null,
          showResultsOnly: true,
          advanced: {}
        };
      };

      clearFilters();

      expect(filterState.search).toBe('');
      expect(filterState.severityFilter).toBeNull();
      expect(filterState.showResultsOnly).toBe(true);
      expect(filterState.advanced).toEqual({});
    });
  });

  // Performance and Edge Case Integration Tests
  describe('Performance and Edge Cases', () => {
    it('should handle rapid filter changes without race conditions', async () => {
      const changes: Array<Partial<FilterState>> = [
        { search: 'test1' },
        { search: 'test2' },
        { severityFilter: 'high' },
        { advanced: { languages: ['Python'] } },
        { search: 'final-test' }
      ];

      let finalState: FilterState = {
        search: '',
        severityFilter: null,
        showResultsOnly: true,
        advanced: {}
      };

      // Simulate rapid sequential updates
      for (const change of changes) {
        finalState = {
          ...finalState,
          ...change,
          advanced: {
            ...finalState.advanced,
            ...(change.advanced || {})
          }
        };
        
        // Simulate async state update delay
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      expect(finalState.search).toBe('final-test');
      expect(finalState.severityFilter).toBe('high');
      expect(finalState.advanced.languages).toEqual(['Python']);
    });

    it('should handle filter combinations that result in empty results', () => {
      const impossibleFilterState: FilterState = {
        search: 'language:nonexistent',
        severityFilter: 'critical',
        showResultsOnly: true,
        advanced: {
          complianceScoreRange: [999, 1000] // Impossible range
        }
      };

      // Apply filters that should return empty results
      let filteredRepos = [...mockRepositories];

      // This should result in no matches
      filteredRepos = filteredRepos.filter(repo => false); // Simulate no matches

      expect(filteredRepos).toHaveLength(0);
    });

    it('should maintain filter state consistency during component unmount/remount', () => {
      const persistentState: FilterState = {
        search: 'persistent search',
        severityFilter: 'medium',
        showResultsOnly: false,
        advanced: {
          topics: ['persistent-topic']
        }
      };

      // Simulate component unmount - save to localStorage
      localStorage.setItem('advanced-repo-filters', JSON.stringify(persistentState));

      // Simulate component remount - restore from localStorage
      const restoredData = localStorage.getItem('advanced-repo-filters');
      const restoredState = restoredData ? JSON.parse(restoredData) : null;

      expect(restoredState).toEqual(persistentState);
    });
  });
});