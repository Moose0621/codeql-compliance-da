import { describe, it, expect, beforeEach } from 'vitest';
import type { FilterPreset, Repository } from '@/types/dashboard';

// Filter Presets Tests - Test Strategy for Advanced Filtering System
describe('Filter Presets - Advanced Search System', () => {
  const mockRepositories: Repository[] = [
    {
      id: 1,
      name: 'secure-frontend',
      full_name: 'org/secure-frontend',
      owner: { login: 'org', avatar_url: 'avatar.png' },
      has_codeql_workflow: true,
      last_scan_status: 'success',
      workflow_dispatch_enabled: true,
      default_branch: 'main',
      security_findings: { critical: 0, high: 0, medium: 1, low: 2, note: 0, total: 3 },
      languages: ['TypeScript', 'React'],
      topics: ['frontend', 'secure'],
      compliance_score: 95,
      last_activity_date: '2024-01-15T10:00:00Z'
    },
    {
      id: 2,
      name: 'vulnerable-api',
      full_name: 'org/vulnerable-api',
      owner: { login: 'org', avatar_url: 'avatar.png' },
      has_codeql_workflow: true,
      last_scan_status: 'success',
      workflow_dispatch_enabled: true,
      default_branch: 'main',
      security_findings: { critical: 3, high: 5, medium: 8, low: 2, note: 1, total: 19 },
      languages: ['Python', 'FastAPI'],
      topics: ['api', 'backend'],
      compliance_score: 25,
      last_activity_date: '2024-01-10T10:00:00Z'
    },
    {
      id: 3,
      name: 'legacy-system',
      full_name: 'org/legacy-system',
      owner: { login: 'org', avatar_url: 'avatar.png' },
      has_codeql_workflow: false,
      last_scan_status: 'pending',
      workflow_dispatch_enabled: false,
      default_branch: 'master',
      security_findings: { critical: 1, high: 3, medium: 5, low: 0, note: 0, total: 9 },
      languages: ['Java', 'Spring'],
      topics: ['legacy', 'enterprise'],
      compliance_score: 45,
      last_activity_date: '2023-11-20T10:00:00Z'
    },
    {
      id: 4,
      name: 'clean-mobile-app',
      full_name: 'org/clean-mobile-app',
      owner: { login: 'org', avatar_url: 'avatar.png' },
      has_codeql_workflow: true,
      last_scan_status: 'success',
      workflow_dispatch_enabled: true,
      default_branch: 'main',
      security_findings: { critical: 0, high: 0, medium: 0, low: 0, note: 0, total: 0 },
      languages: ['Swift', 'Kotlin'],
      topics: ['mobile', 'ios', 'android'],
      compliance_score: 98,
      last_activity_date: '2024-01-14T10:00:00Z'
    }
  ];

  // Predefined filter presets
  const defaultPresets: FilterPreset[] = [
    {
      id: 'high-risk',
      name: 'High Risk Repositories',
      description: 'Repositories with critical or high severity security findings',
      icon: '🚨',
      filters: {
        search: '',
        severityFilter: 'critical',
        showResultsOnly: true,
        advanced: {
          complianceScoreRange: [0, 70]
        }
      }
    },
    {
      id: 'needs-attention',
      name: 'Needs Attention',
      description: 'Repositories requiring immediate security review',
      icon: '⚠️',
      filters: {
        search: 'status:needs-attention OR status:has-findings',
        severityFilter: null,
        showResultsOnly: true,
        advanced: {
          complianceScoreRange: [0, 60],
          lastScanAge: '30d'
        }
      }
    },
    {
      id: 'clean-repos',
      name: 'Clean Repositories',
      description: 'Repositories with no security findings',
      icon: '✅',
      filters: {
        search: 'status:no-findings',
        severityFilter: 'none',
        showResultsOnly: false,
        advanced: {
          complianceScoreRange: [90, 100]
        }
      }
    },
    {
      id: 'frontend-focus',
      name: 'Frontend Projects',
      description: 'Focus on frontend and web applications',
      icon: '🌐',
      filters: {
        search: 'topic:frontend OR topic:web',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {
          languages: ['TypeScript', 'JavaScript', 'React', 'Vue'],
          topics: ['frontend', 'web', 'ui']
        }
      }
    },
    {
      id: 'backend-services',
      name: 'Backend Services',
      description: 'Focus on API and backend services',
      icon: '🔧',
      filters: {
        search: 'topic:api OR topic:backend',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {
          languages: ['Python', 'Java', 'Go', 'Node.js'],
          topics: ['api', 'backend', 'microservice']
        }
      }
    },
    {
      id: 'mobile-apps',
      name: 'Mobile Applications',
      description: 'Focus on mobile application development',
      icon: '📱',
      filters: {
        search: 'topic:mobile',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {
          languages: ['Swift', 'Kotlin', 'Flutter', 'React Native'],
          topics: ['mobile', 'ios', 'android']
        }
      }
    },
    {
      id: 'legacy-systems',
      name: 'Legacy Systems',
      description: 'Older systems that may need modernization',
      icon: '🏛️',
      filters: {
        search: 'topic:legacy',
        severityFilter: null,
        showResultsOnly: false,
        advanced: {
          topics: ['legacy', 'enterprise'],
          activityPeriod: '6m',  // Older than 6 months
          complianceScoreRange: [0, 80]
        }
      }
    }
  ];

  // Mock localStorage for preset persistence
  const mockPresetStorage = new Map<string, string>();
  
  beforeEach(() => {
    mockPresetStorage.clear();
  });

  // Helper function to apply filter (available to all test suites)
  const applyPresetFilters = (repositories: Repository[], preset: FilterPreset): Repository[] => {
    const { filters } = preset;
    let filtered = [...repositories];

    // Apply severity filter
    if (filters.severityFilter) {
      filtered = filtered.filter(repo => {
        const findings = repo.security_findings;
        if (!findings) return filters.severityFilter === 'none';
        
        switch (filters.severityFilter) {
          case 'critical': return findings.critical > 0;
          case 'high': return findings.high > 0;
          case 'medium': return findings.medium > 0;
          case 'low': return findings.low > 0;
          case 'note': return findings.note > 0;
          case 'none': return findings.total === 0;
          default: return true;
        }
      });
    }

    // Apply results-only filter
    if (filters.showResultsOnly) {
      filtered = filtered.filter(repo => 
        repo.security_findings && repo.security_findings.total > 0
      );
    }

    // Apply compliance score range
    if (filters.advanced.complianceScoreRange) {
      const [min, max] = filters.advanced.complianceScoreRange;
      filtered = filtered.filter(repo => {
        const score = repo.compliance_score ?? 0;
        return score >= min && score <= max;
      });
    }

    // Apply language filter
    if (filters.advanced.languages?.length) {
      filtered = filtered.filter(repo =>
        repo.languages && filters.advanced.languages!.some(lang =>
          repo.languages!.includes(lang)
        )
      );
    }

    // Apply topic filter
    if (filters.advanced.topics?.length) {
      filtered = filtered.filter(repo =>
        repo.topics && filters.advanced.topics!.some(topic =>
          repo.topics!.includes(topic)
        )
      );
    }

    return filtered;
  };

  // Preset Management Tests
  describe('Preset Management', () => {
    it('should provide default filter presets', () => {
      expect(defaultPresets).toHaveLength(7);
      expect(defaultPresets.map(p => p.id)).toContain('high-risk');
      expect(defaultPresets.map(p => p.id)).toContain('clean-repos');
      expect(defaultPresets.map(p => p.id)).toContain('frontend-focus');
    });

    it('should validate preset structure', () => {
      defaultPresets.forEach(preset => {
        expect(preset.id).toBeDefined();
        expect(preset.name).toBeDefined();
        expect(preset.description).toBeDefined();
        expect(preset.filters).toBeDefined();
        expect(typeof preset.filters.search).toBe('string');
        expect(preset.filters.showResultsOnly).toBeDefined();
        expect(preset.filters.advanced).toBeDefined();
      });
    });

    it('should save custom presets to storage', () => {
      const customPreset: FilterPreset = {
        id: 'my-custom-preset',
        name: 'My Custom Filter',
        description: 'Custom filter for TypeScript projects with high compliance',
        filters: {
          search: 'language:typescript',
          severityFilter: null,
          showResultsOnly: false,
          advanced: {
            complianceScoreRange: [80, 100],
            languages: ['TypeScript']
          }
        }
      };

      // Simulate saving preset
      const savedPresets = [customPreset];
      mockPresetStorage.set('custom-filter-presets', JSON.stringify(savedPresets));

      const stored = mockPresetStorage.get('custom-filter-presets');
      const parsed = stored ? JSON.parse(stored) : [];

      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('my-custom-preset');
      expect(parsed[0].name).toBe('My Custom Filter');
    });

    it('should load and merge custom presets with defaults', () => {
      const customPreset: FilterPreset = {
        id: 'typescript-expert',
        name: 'TypeScript Expert',
        description: 'Advanced TypeScript projects',
        filters: {
          search: 'language:typescript AND topic:advanced',
          severityFilter: null,
          showResultsOnly: false,
          advanced: {
            languages: ['TypeScript'],
            topics: ['advanced', 'expert']
          }
        }
      };

      mockPresetStorage.set('custom-filter-presets', JSON.stringify([customPreset]));

      // Simulate loading all presets
      const customPresetsData = mockPresetStorage.get('custom-filter-presets');
      const customPresets = customPresetsData ? JSON.parse(customPresetsData) : [];
      const allPresets = [...defaultPresets, ...customPresets];

      expect(allPresets).toHaveLength(8); // 7 default + 1 custom
      expect(allPresets.map(p => p.id)).toContain('typescript-expert');
    });

    it('should delete custom presets', () => {
      const presets = [
        { 
          id: 'preset1', 
          name: 'Preset 1', 
          description: 'Test preset 1', 
          filters: {
            search: 'test1',
            severityFilter: null,
            showResultsOnly: false,
            advanced: {}
          }
        },
        { 
          id: 'preset2', 
          name: 'Preset 2', 
          description: 'Test preset 2', 
          filters: {
            search: 'test2',
            severityFilter: null,
            showResultsOnly: true,
            advanced: {}
          }
        }
      ];

      mockPresetStorage.set('custom-filter-presets', JSON.stringify(presets));

      // Simulate deleting preset1
      const remaining = presets.filter(p => p.id !== 'preset1');
      mockPresetStorage.set('custom-filter-presets', JSON.stringify(remaining));

      const stored = mockPresetStorage.get('custom-filter-presets');
      const parsed = stored ? JSON.parse(stored) : [];

      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('preset2');
    });
  });

  // Preset Application Tests
  describe('Preset Application', () => {
    it('should apply "High Risk" preset correctly', () => {
      const highRiskPreset = defaultPresets.find(p => p.id === 'high-risk')!;
      const filtered = applyPresetFilters(mockRepositories, highRiskPreset);

      // Should include both vulnerable-api (critical findings + low compliance) and legacy-system (critical findings + low compliance)
      expect(filtered).toHaveLength(2); 
      expect(filtered.map(r => r.name)).toContain('vulnerable-api');
      expect(filtered.map(r => r.name)).toContain('legacy-system');
    });

    it('should apply "Clean Repositories" preset correctly', () => {
      const cleanPreset = defaultPresets.find(p => p.id === 'clean-repos')!;
      const filtered = applyPresetFilters(mockRepositories, cleanPreset);

      // Should include clean-mobile-app (no findings, high compliance score)
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('clean-mobile-app');
    });

    it('should apply "Frontend Focus" preset correctly', () => {
      const frontendPreset = defaultPresets.find(p => p.id === 'frontend-focus')!;
      const filtered = applyPresetFilters(mockRepositories, frontendPreset);

      // Should include secure-frontend (has frontend topic)
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('secure-frontend');
      expect(filtered[0].topics).toContain('frontend');
    });

    it('should apply "Mobile Applications" preset correctly', () => {
      const mobilePreset = defaultPresets.find(p => p.id === 'mobile-apps')!;
      const filtered = applyPresetFilters(mockRepositories, mobilePreset);

      // Should include clean-mobile-app
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('clean-mobile-app');
      expect(filtered[0].topics).toContain('mobile');
    });

    it('should apply "Legacy Systems" preset correctly', () => {
      const legacyPreset = defaultPresets.find(p => p.id === 'legacy-systems')!;
      const filtered = applyPresetFilters(mockRepositories, legacyPreset);

      // Should include legacy-system
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('legacy-system');
      expect(filtered[0].topics).toContain('legacy');
    });

    it('should handle empty results for non-matching presets', () => {
      const customPreset: FilterPreset = {
        id: 'impossible-filter',
        name: 'Impossible Filter',
        description: 'Filter that matches nothing',
        filters: {
          search: '',
          severityFilter: null,
          showResultsOnly: false,
          advanced: {
            languages: ['NonexistentLanguage'],
            complianceScoreRange: [999, 1000]
          }
        }
      };

      const filtered = applyPresetFilters(mockRepositories, customPreset);
      expect(filtered).toHaveLength(0);
    });
  });

  // Preset Validation and Error Handling
  describe('Preset Validation', () => {
    it('should validate preset filter structure', () => {
      const validPreset: FilterPreset = {
        id: 'valid-preset',
        name: 'Valid Preset',
        description: 'A valid preset for testing',
        filters: {
          search: 'test',
          severityFilter: 'high',
          showResultsOnly: true,
          advanced: {
            languages: ['TypeScript'],
            complianceScoreRange: [70, 100]
          }
        }
      };

      // Validate required fields
      expect(validPreset.id).toBeDefined();
      expect(validPreset.name).toBeDefined();
      expect(validPreset.description).toBeDefined();
      expect(validPreset.filters).toBeDefined();
      expect(typeof validPreset.filters.search).toBe('string');
      expect(typeof validPreset.filters.showResultsOnly).toBe('boolean');
    });

    it('should handle invalid preset data gracefully', () => {
      const invalidPresets = [
        { id: '', name: 'Empty ID', description: 'Test', filters: {
          search: '',
          severityFilter: null,
          showResultsOnly: false,
          advanced: {}
        }},
        { id: 'no-name', name: '', description: 'Test', filters: {
          search: '',
          severityFilter: null,
          showResultsOnly: false,
          advanced: {}
        }},
        { id: 'no-filters', name: 'No Filters', description: 'Test', filters: undefined as any }
      ];

      invalidPresets.forEach(preset => {
        // Should identify invalid presets
        const isValid = preset.id && preset.name && preset.filters;
        expect(isValid).toBeFalsy();
      });
    });

    it('should handle corrupted preset storage', () => {
      // Store invalid JSON
      mockPresetStorage.set('custom-filter-presets', 'invalid-json-data');

      let customPresets: FilterPreset[] = [];
      try {
        const stored = mockPresetStorage.get('custom-filter-presets');
        if (stored) {
          customPresets = JSON.parse(stored);
        }
      } catch (error) {
        // Handle corrupted data gracefully
        customPresets = [];
      }

      expect(customPresets).toEqual([]);
    });
  });

  // Preset Performance Tests
  describe('Preset Performance', () => {
    const generateLargeRepositorySet = (count: number): Repository[] => {
      return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `repo-${i + 1}`,
        full_name: `org/repo-${i + 1}`,
        owner: { login: 'org', avatar_url: 'avatar.png' },
        has_codeql_workflow: i % 2 === 0,
        last_scan_status: ['success', 'failure', 'pending'][i % 3] as any,
        workflow_dispatch_enabled: i % 3 === 0,
        default_branch: 'main',
        security_findings: {
          critical: Math.floor(Math.random() * 5),
          high: Math.floor(Math.random() * 10),
          medium: Math.floor(Math.random() * 15),
          low: Math.floor(Math.random() * 20),
          note: Math.floor(Math.random() * 5),
          total: Math.floor(Math.random() * 55)
        },
        languages: [`Language${i % 10}`],
        topics: [`topic${i % 20}`],
        compliance_score: Math.floor(Math.random() * 100),
        last_activity_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
      }));
    };

    it('should apply presets efficiently on large datasets', () => {
      const largeRepoSet = generateLargeRepositorySet(1000);
      const highRiskPreset = defaultPresets.find(p => p.id === 'high-risk')!;

      const startTime = performance.now();
      const filtered = applyPresetFilters(largeRepoSet, highRiskPreset);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      
      // Should complete within reasonable time for 1000 repositories
      expect(executionTime).toBeLessThan(100); // 100ms threshold
      expect(filtered).toBeInstanceOf(Array);
      expect(filtered.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle preset switching efficiently', () => {
      const testRepos = generateLargeRepositorySet(500);
      const presetIds = ['high-risk', 'clean-repos', 'frontend-focus', 'backend-services'];
      
      const startTime = performance.now();
      
      // Apply multiple presets in sequence
      presetIds.forEach(presetId => {
        const preset = defaultPresets.find(p => p.id === presetId)!;
        applyPresetFilters(testRepos, preset);
      });
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should handle multiple preset applications efficiently
      expect(totalTime).toBeLessThan(200); // 200ms for 4 preset applications
    });
  });

  // Preset UI Integration Tests
  describe('Preset UI Integration', () => {
    it('should provide preset metadata for UI rendering', () => {
      defaultPresets.forEach(preset => {
        expect(preset.name).toMatch(/^[A-Za-z0-9\s-]+$/); // User-friendly name
        expect(preset.description.length).toBeGreaterThan(10); // Meaningful description
        expect(preset.description.length).toBeLessThan(100); // Not too long for UI
        
        if (preset.icon) {
          expect(preset.icon.length).toBeGreaterThan(0); // Just check it's not empty
          expect(preset.icon.length).toBeLessThan(10); // Reasonable emoji length
        }
      });
    });

    it('should support preset categorization', () => {
      // Group presets by category for UI organization
      const securityPresets = defaultPresets.filter(p => 
        p.id.includes('risk') || p.id.includes('clean') || p.id.includes('attention')
      );
      
      const technologyPresets = defaultPresets.filter(p =>
        p.id.includes('frontend') || p.id.includes('backend') || p.id.includes('mobile')
      );
      
      const maintenancePresets = defaultPresets.filter(p =>
        p.id.includes('legacy')
      );

      expect(securityPresets.length).toBeGreaterThan(0);
      expect(technologyPresets.length).toBeGreaterThan(0);
      expect(maintenancePresets.length).toBeGreaterThan(0);
    });

    it('should provide preset usage statistics', () => {
      // Mock preset usage tracking
      const presetUsageStats = {
        'high-risk': { usageCount: 45, lastUsed: '2024-01-15T10:00:00Z' },
        'clean-repos': { usageCount: 23, lastUsed: '2024-01-14T15:30:00Z' },
        'frontend-focus': { usageCount: 67, lastUsed: '2024-01-16T09:15:00Z' }
      };

      // Most popular presets should be easily identifiable
      const sortedByUsage = Object.entries(presetUsageStats)
        .sort(([, a], [, b]) => b.usageCount - a.usageCount)
        .map(([presetId]) => presetId);

      expect(sortedByUsage[0]).toBe('frontend-focus'); // Most used
      expect(sortedByUsage[1]).toBe('high-risk'); // Second most used
    });
  });
});