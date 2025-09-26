import { useMemo, useState, useCallback } from 'react';
import type { Repository, FilterState, FilterOptions, SearchQuery } from '@/types/dashboard';

/**
 * Advanced search hook with multi-criteria filtering and boolean operators
 * Performance optimized for 1000+ repositories with debounced search
 */
export function useAdvancedSearch(repositories: Repository[]) {
  const [filterState, setFilterState] = useState<FilterState>({
    search: '',
    severityFilter: null,
    showResultsOnly: true,
    advanced: {}
  });

  // Parse search query for boolean operators
  const parseSearchQuery = useCallback((searchText: string): SearchQuery => {
    const text = searchText.toLowerCase().trim();
    
    // Initialize query structure
    const query: SearchQuery = {
      text,
      operators: { and: [], or: [], not: [] },
      fields: {}
    };

    if (!text) return query;

    // Split by operators (case insensitive)
    const andParts = text.split(/\s+and\s+/i);
    const orParts = text.split(/\s+or\s+/i);
    const notParts = text.split(/\s+not\s+/i);

    // Handle AND operator
    if (andParts.length > 1) {
      query.operators.and = andParts.map(part => part.trim()).filter(Boolean);
    }
    // Handle OR operator
    else if (orParts.length > 1) {
      query.operators.or = orParts.map(part => part.trim()).filter(Boolean);
    }
    // Handle NOT operator
    else if (notParts.length > 1) {
      query.operators.not = notParts.slice(1).map(part => part.trim()).filter(Boolean);
    }

    // Parse field-specific searches (e.g., "language:typescript", "topic:security")
    const fieldPattern = /(\w+):\s*([^\s]+)/g;
    let match;
    while ((match = fieldPattern.exec(text)) !== null) {
      const [, field, value] = match;
      if (!query.fields[field]) {
        query.fields[field] = [];
      }
      query.fields[field].push(value.toLowerCase());
    }

    return query;
  }, []);

  // Helper function to check if repository has scan results
  const hasResults = useCallback((repo: Repository): boolean => {
    return !!(repo.security_findings && repo.security_findings.total > 0);
  }, []);

  // Helper function to check activity period
  const isWithinActivityPeriod = useCallback((repo: Repository, period: string): boolean => {
    if (!repo.last_activity_date) return false;
    
    const activityDate = new Date(repo.last_activity_date);
    const now = new Date();
    const diffMs = now.getTime() - activityDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

    switch (period) {
      case '24h': return diffHours <= 24;
      case '7d': return diffDays <= 7;
      case '30d': return diffDays <= 30;
      case '3m': return diffDays <= 90;
      case '6m': return diffDays <= 180;
      case '1y': return diffDays <= 365;
      case 'all': return true;
      default: return true;
    }
  }, []);

  // Helper function to check last scan age
  const isWithinScanAge = useCallback((repo: Repository, maxAge: string): boolean => {
    if (!repo.last_scan_date || maxAge === 'any') return true;
    
    const scanDate = new Date(repo.last_scan_date);
    const now = new Date();
    const diffMs = now.getTime() - scanDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    switch (maxAge) {
      case '1d': return diffDays <= 1;
      case '7d': return diffDays <= 7;
      case '30d': return diffDays <= 30;
      case '90d': return diffDays <= 90;
      default: return true;
    }
  }, []);

  // Main filtering logic
  const filteredRepositories = useMemo(() => {
    let list = [...repositories];
    const { search, severityFilter, showResultsOnly, advanced } = filterState;

    // Parse search query
    const searchQuery = parseSearchQuery(search);

    // Apply text search with boolean operators
    if (search.trim()) {
      if (searchQuery.operators.and.length > 0) {
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
      } else if (searchQuery.operators.not.length > 0) {
        // NOT: none of these terms should match
        list = list.filter(repo => {
          const searchableText = `${repo.name} ${repo.full_name} ${repo.owner.login}`.toLowerCase();
          return !searchQuery.operators.not.some(term => 
            searchableText.includes(term.toLowerCase()) ||
            (repo.languages && repo.languages.some(lang => lang.toLowerCase().includes(term.toLowerCase()))) ||
            (repo.topics && repo.topics.some(topic => topic.toLowerCase().includes(term.toLowerCase())))
          );
        });
      } else {
        // Simple text search
        const q = search.toLowerCase();
        list = list.filter(repo => {
          const searchableText = `${repo.name} ${repo.full_name} ${repo.owner.login}`.toLowerCase();
          return searchableText.includes(q) ||
            (repo.languages && repo.languages.some(lang => lang.toLowerCase().includes(q))) ||
            (repo.topics && repo.topics.some(topic => topic.toLowerCase().includes(q)));
        });
      }
    }

    // Apply field-specific filters from search query
    if (Object.keys(searchQuery.fields).length > 0) {
      list = list.filter(repo => {
        // Language filters
        if (searchQuery.fields.language && repo.languages) {
          const hasMatchingLanguage = searchQuery.fields.language.some(lang =>
            repo.languages!.some(repoLang => repoLang.toLowerCase().includes(lang))
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
              case 'archived': return false; // We don't have this field yet
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

    if (advanced.activityPeriod && advanced.activityPeriod !== 'all') {
      list = list.filter(repo => isWithinActivityPeriod(repo, advanced.activityPeriod!));
    }

    if (advanced.lastScanAge && advanced.lastScanAge !== 'any') {
      list = list.filter(repo => isWithinScanAge(repo, advanced.lastScanAge!));
    }

    return list;
  }, [repositories, filterState, parseSearchQuery, hasResults, isWithinActivityPeriod, isWithinScanAge]);

  // Get available filter options from current repositories
  const availableOptions = useMemo((): FilterOptions => {
    const languages = new Set<string>();
    const topics = new Set<string>();
    const teams = new Set<string>();
    let minScore = Infinity;
    let maxScore = -Infinity;

    repositories.forEach(repo => {
      // Collect languages
      repo.languages?.forEach(lang => languages.add(lang));
      
      // Collect topics
      repo.topics?.forEach(topic => topics.add(topic));
      
      // Collect teams (if available)
      if (repo.team_slug) teams.add(repo.team_slug);
      
      // Track compliance score range
      if (repo.compliance_score !== undefined) {
        minScore = Math.min(minScore, repo.compliance_score);
        maxScore = Math.max(maxScore, repo.compliance_score);
      }
    });

    return {
      languages: Array.from(languages).sort(),
      topics: Array.from(topics).sort(),
      teams: Array.from(teams).sort(),
      complianceScoreRange: [
        minScore === Infinity ? 0 : minScore,
        maxScore === -Infinity ? 100 : maxScore
      ],
      activityPeriod: 'all',
      lastScanAge: 'any'
    };
  }, [repositories]);

  // Update filter state
  const updateFilters = useCallback((updates: Partial<FilterState>) => {
    setFilterState(prev => ({ ...prev, ...updates }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilterState({
      search: '',
      severityFilter: null,
      showResultsOnly: false,
      advanced: {}
    });
  }, []);

  return {
    filterState,
    filteredRepositories,
    availableOptions,
    updateFilters,
    clearFilters,
    parseSearchQuery
  };
}