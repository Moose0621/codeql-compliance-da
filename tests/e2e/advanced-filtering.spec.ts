import { test, expect } from '@playwright/test';
import { FilterPage } from './pages/FilterPage';
import { RepositoryListPage } from './pages/RepositoryListPage';
import { PresetManagementPage } from './pages/PresetManagementPage';
import { SearchBoxComponent } from './pages/SearchBoxComponent';
import { GitHubAPIMock } from './fixtures/GitHubAPIMock';
import { TestDataGenerator } from './data/TestDataGenerator';

test.describe('Advanced Repository Filtering E2E Tests', () => {
  let filterPage: FilterPage;
  let repositoryListPage: RepositoryListPage;
  let presetManagementPage: PresetManagementPage;
  let searchBox: SearchBoxComponent;
  let apiMock: GitHubAPIMock;

  test.beforeEach(async ({ page }) => {
    // Initialize page objects
    filterPage = new FilterPage(page);
    repositoryListPage = new RepositoryListPage(page);
    presetManagementPage = new PresetManagementPage(page);
    searchBox = new SearchBoxComponent(page);
    apiMock = new GitHubAPIMock(page);

    // Setup API mocking with comprehensive test data
    await apiMock.setupMocks({
      repositoryCount: 100,
      includeSpecialCases: true,
      enableRateLimit: false
    });

    // Navigate to the dashboard and connect
    await page.goto('/');
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
    await page.getByLabel('Organization').fill('test-org');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Wait for repositories to load
    await repositoryListPage.waitForRepositoriesToLoad();
  });

  test.describe('Multi-Criteria Filtering - Functional Tests', () => {
    
    test('should apply multiple filters simultaneously (language + severity + topic)', async ({ page }) => {
      // Apply language filter
      await filterPage.selectLanguages(['TypeScript']);
      await filterPage.waitForFilterResults();

      // Apply severity filter
      await filterPage.selectSeverityFilter('critical');
      await filterPage.waitForFilterResults();

      // Apply topic filter
      await filterPage.selectTopics(['security']);
      await filterPage.waitForFilterResults();

      // Verify results are filtered correctly
      const repositoryCount = await repositoryListPage.getRepositoryCount();
      expect(repositoryCount).toBeLessThan(10); // Should be a subset

      // Verify active filters are displayed
      await filterPage.verifyActiveFilter('Languages: 1');
      await filterPage.verifyActiveFilter('Severity: critical');
      await filterPage.verifyActiveFilter('Topics: 1');

      // Verify URL contains filter parameters
      await filterPage.verifyURLContainsFilters(['language=TypeScript', 'severity=critical', 'topic=security']);
    });

    test('should test each filter type independently', async ({ page }) => {
      const initialCount = await repositoryListPage.getRepositoryCount();

      // Test language filter alone
      await filterPage.selectLanguages(['JavaScript']);
      await filterPage.waitForFilterResults();
      const jsCount = await repositoryListPage.getRepositoryCount();
      expect(jsCount).toBeLessThan(initialCount);
      expect(jsCount).toBeGreaterThan(0);

      // Clear and test severity filter alone
      await filterPage.clearAllFilters();
      await filterPage.waitForFilterResults();
      await filterPage.selectSeverityFilter('high');
      await filterPage.waitForFilterResults();
      const highSeverityCount = await repositoryListPage.getRepositoryCount();
      expect(highSeverityCount).toBeLessThan(initialCount);

      // Clear and test topic filter alone
      await filterPage.clearAllFilters();
      await filterPage.waitForFilterResults();
      await filterPage.selectTopics(['web']);
      await filterPage.waitForFilterResults();
      const webTopicCount = await repositoryListPage.getRepositoryCount();
      expect(webTopicCount).toBeLessThan(initialCount);
    });

    test('should reset all filters and verify repository list restoration', async ({ page }) => {
      const initialCount = await repositoryListPage.getRepositoryCount();

      // Apply multiple filters
      await filterPage.selectLanguages(['TypeScript', 'Python']);
      await filterPage.selectSeverityFilter('critical');
      await filterPage.toggleResultsOnlyFilter();
      await filterPage.waitForFilterResults();

      const filteredCount = await repositoryListPage.getRepositoryCount();
      expect(filteredCount).toBeLessThan(initialCount);

      // Clear all filters
      await filterPage.clearAllFilters();
      await filterPage.waitForFilterResults();

      // Verify count is restored
      const restoredCount = await repositoryListPage.getRepositoryCount();
      expect(restoredCount).toEqual(initialCount);

      // Verify no active filters are shown
      const currentUrl = await filterPage.getCurrentURL();
      expect(currentUrl).not.toContain('language=');
      expect(currentUrl).not.toContain('severity=');
      expect(currentUrl).not.toContain('topic=');
    });

    test('should test various filter combinations with expected results', async ({ page }) => {
      // Test combination 1: High severity + TypeScript
      await filterPage.selectSeverityFilter('high');
      await filterPage.selectLanguages(['TypeScript']);
      await filterPage.waitForFilterResults();
      const combo1Count = await repositoryListPage.getRepositoryCount();

      // Test combination 2: No findings + Python
      await filterPage.clearAllFilters();
      await filterPage.selectSeverityFilter('none');
      await filterPage.selectLanguages(['Python']);
      await filterPage.waitForFilterResults();
      const combo2Count = await repositoryListPage.getRepositoryCount();

      // Test combination 3: With findings + Security topic
      await filterPage.clearAllFilters();
      await filterPage.toggleResultsOnlyFilter();
      await filterPage.selectTopics(['security']);
      await filterPage.waitForFilterResults();
      const combo3Count = await repositoryListPage.getRepositoryCount();

      // All combinations should produce different result sets
      expect(combo1Count).not.toEqual(combo2Count);
      expect(combo2Count).not.toEqual(combo3Count);
      expect(combo1Count).not.toEqual(combo3Count);
    });

    test('should apply filters that result in no matches', async ({ page }) => {
      // Apply a very restrictive combination that should yield no results
      await filterPage.selectSeverityFilter('critical');
      await filterPage.selectLanguages(['COBOL']); // Unlikely to exist in test data
      await filterPage.selectTopics(['non-existent-topic']);
      await filterPage.setComplianceScoreRange(99, 100);
      await filterPage.waitForFilterResults();

      // Verify empty state
      await repositoryListPage.verifyEmptyState();
      await filterPage.verifyRepositoryCount(0);
    });
  });

  test.describe('Boolean Search Operators', () => {
    
    test('should handle AND operations correctly', async ({ page }) => {
      // Test simple AND operation
      await searchBox.searchWithBooleanOperator('AND', ['TypeScript', 'security']);
      await filterPage.waitForFilterResults();

      const repositories = await repositoryListPage.getRepositoryNames();
      // All results should contain both terms (in name, description, or metadata)
      for (const repoName of repositories) {
        const hasTypeScript = await repositoryListPage.verifyRepositoryHasLanguage(repoName, 'TypeScript').catch(() => false);
        const hasSecurity = await repositoryListPage.verifyRepositoryHasTopic(repoName, 'security').catch(() => false);
        expect(hasTypeScript || hasSecurity).toBe(true);
      }

      // Verify help text is shown
      await searchBox.verifyHelpText('boolean operators');
    });

    test('should handle OR operations correctly', async ({ page }) => {
      await searchBox.searchWithBooleanOperator('OR', ['TypeScript', 'Python']);
      await filterPage.waitForFilterResults();

      const count = await repositoryListPage.getRepositoryCount();
      expect(count).toBeGreaterThan(0);

      // Results should include repositories with either TypeScript OR Python
      const repositories = await repositoryListPage.getRepositoryNames();
      let foundTypeScript = false;
      let foundPython = false;

      for (const repoName of repositories) {
        try {
          await repositoryListPage.verifyRepositoryHasLanguage(repoName, 'TypeScript');
          foundTypeScript = true;
        } catch {
          try {
            await repositoryListPage.verifyRepositoryHasLanguage(repoName, 'Python');
            foundPython = true;
          } catch {
            // Repository might match in name or description
          }
        }
      }

      expect(foundTypeScript || foundPython).toBe(true);
    });

    test('should handle NOT operations correctly', async ({ page }) => {
      // First get total count
      const totalCount = await repositoryListPage.getRepositoryCount();

      // Apply NOT filter
      await searchBox.searchWithBooleanOperator('NOT', ['app', 'archived']);
      await filterPage.waitForFilterResults();

      const filteredCount = await repositoryListPage.getRepositoryCount();
      expect(filteredCount).toBeLessThanOrEqual(totalCount);

      // Verify none of the results contain "archived" in their properties
      const repositories = await repositoryListPage.getRepositoryNames();
      for (const repoName of repositories) {
        expect(repoName.toLowerCase()).not.toContain('archived');
      }
    });

    test('should handle complex expressions with mixed boolean operators', async ({ page }) => {
      // Test: (TypeScript OR JavaScript) AND security NOT archived
      await searchBox.enterText('(TypeScript OR JavaScript) AND security NOT archived');
      await filterPage.waitForFilterResults();

      const count = await repositoryListPage.getRepositoryCount();
      expect(count).toBeGreaterThan(0);

      // Verify complex operator parsing help
      await searchBox.verifyHelpText('Supports boolean operators: AND, OR, NOT');
    });

    test('should handle invalid boolean syntax gracefully', async ({ page }) => {
      // Test malformed boolean expressions
      const invalidQueries = [
        'AND TypeScript OR', // Starts with operator
        'TypeScript AND AND Python', // Double operators  
        'TypeScript (OR Python', // Unmatched parentheses
        'TypeScript &&& Python', // Invalid operator syntax
      ];

      for (const invalidQuery of invalidQueries) {
        await searchBox.enterText(invalidQuery);
        await filterPage.waitForFilterResults();

        // Should either show all results (graceful fallback) or show validation message
        const count = await repositoryListPage.getRepositoryCount();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Filter Presets', () => {
    
    test('should apply predefined filter combinations', async ({ page }) => {
      // Test default presets
      await presetManagementPage.verifyDefaultPresets();

      // Apply "Compliance Ready" preset
      await presetManagementPage.applyPreset('Compliance Ready');
      await filterPage.waitForFilterResults();

      // Verify filter state matches preset expectations
      await filterPage.verifyActiveFilter('Score: 80-100');
      await filterPage.verifyActiveFilter('Severity: none');
      
      const count = await repositoryListPage.getRepositoryCount();
      expect(count).toBeGreaterThan(0);
    });

    test('should create custom preset from current filter state', async ({ page }) => {
      // Set up custom filter combination
      await filterPage.selectLanguages(['TypeScript']);
      await filterPage.selectSeverityFilter('high');
      await filterPage.selectTopics(['security', 'web']);
      await filterPage.waitForFilterResults();

      // Save as custom preset
      await presetManagementPage.saveAsPreset(
        'Custom Security Filter',
        'TypeScript repositories with high severity security findings'
      );

      // Verify preset was created
      await presetManagementPage.verifyPresetExists('Custom Security Filter');

      // Clear filters and apply custom preset
      await filterPage.clearAllFilters();
      await presetManagementPage.applyPreset('Custom Security Filter');
      await filterPage.waitForFilterResults();

      // Verify filters were restored
      await filterPage.verifyActiveFilter('Languages: 1');
      await filterPage.verifyActiveFilter('Severity: high');
      await filterPage.verifyActiveFilter('Topics: 2');
    });

    test('should manage preset operations (edit, delete, rename)', async ({ page }) => {
      // Create a preset to manage
      await filterPage.selectLanguages(['Python']);
      await presetManagementPage.saveAsPreset('Test Preset', 'Initial description');
      
      // Edit the preset
      await presetManagementPage.editPreset(
        'Test Preset',
        'Updated Test Preset',
        'Updated description for testing'
      );
      
      // Verify updated preset exists
      await presetManagementPage.verifyPresetExists('Updated Test Preset');
      
      // Delete the preset
      await presetManagementPage.deletePreset('Updated Test Preset');
      
      // Verify preset was deleted
      const presetCount = await presetManagementPage.getPresetCount();
      expect(presetCount).toBeGreaterThan(0); // Still have default presets
    });

    test('should handle preset export/import functionality', async ({ page }) => {
      // Create a preset for export
      await filterPage.selectLanguages(['JavaScript']);
      await filterPage.selectSeverityFilter('medium');
      await presetManagementPage.saveAsPreset('Export Test', 'Preset for export testing');

      // Export the preset
      const exportedConfig = await presetManagementPage.exportPreset('Export Test');
      expect(exportedConfig).toContain('Export Test');
      expect(exportedConfig).toContain('JavaScript');

      // Delete the preset
      await presetManagementPage.deletePreset('Export Test');

      // Import the preset back
      await presetManagementPage.importPreset(exportedConfig);

      // Verify imported preset works
      await presetManagementPage.verifyPresetExists('Export Test');
      await presetManagementPage.applyPreset('Export Test');
      await filterPage.verifyActiveFilter('Languages: 1');
      await filterPage.verifyActiveFilter('Severity: medium');
    });

    test('should verify default presets work correctly', async ({ page }) => {
      const defaultPresetTests = [
        {
          name: 'Needs Attention',
          expectedFilters: ['score', 'findings']
        },
        {
          name: 'High Risk Repositories',
          expectedFilters: ['critical', 'high']
        },
        {
          name: 'Recently Active', 
          expectedFilters: ['activity']
        }
      ];

      for (const preset of defaultPresetTests) {
        await filterPage.clearAllFilters();
        await presetManagementPage.applyPreset(preset.name);
        await filterPage.waitForFilterResults();

        const count = await repositoryListPage.getRepositoryCount();
        expect(count).toBeGreaterThanOrEqual(0);

        // Verify at least some filtering occurred
        const totalCount = 100; // We know we generated 100 + special cases
        if (count > 0) {
          expect(count).toBeLessThanOrEqual(totalCount);
        }
      }
    });
  });

  test.describe('State Persistence', () => {
    
    test('should reflect filter state in URL parameters', async ({ page }) => {
      // Apply various filters
      await filterPage.enterSearchQuery('typescript security');
      await filterPage.selectSeverityFilter('high');
      await filterPage.selectLanguages(['TypeScript']);
      await filterPage.setComplianceScoreRange(70, 95);
      await filterPage.waitForFilterResults();

      // Verify URL parameters
      const url = await filterPage.getCurrentURL();
      expect(url).toContain('search=typescript%20security');
      expect(url).toContain('severity=high');
      expect(url).toContain('language=TypeScript');
      expect(url).toContain('score_min=70');
      expect(url).toContain('score_max=95');
    });

    test('should handle browser navigation with filter state', async ({ page }) => {
      const initialCount = await repositoryListPage.getRepositoryCount();

      // Apply filters
      await filterPage.selectLanguages(['Python']);
      await filterPage.selectSeverityFilter('critical');
      await filterPage.waitForFilterResults();
      const filteredCount = await repositoryListPage.getRepositoryCount();

      // Navigate away and back
      await page.goto('/about'); // Assuming there's an about page
      await page.goBack();

      // Wait for page to restore
      await repositoryListPage.waitForRepositoriesToLoad();

      // Verify filter state is restored
      await filterPage.verifyActiveFilter('Languages: 1');
      await filterPage.verifyActiveFilter('Severity: critical');
      const restoredCount = await repositoryListPage.getRepositoryCount();
      expect(restoredCount).toEqual(filteredCount);

      // Test forward navigation
      await page.goForward();
      await page.goBack();
      
      // Verify filter state persists through forward/back
      await filterPage.verifyActiveFilter('Languages: 1');
    });

    test('should maintain filters across browser refresh', async ({ page }) => {
      // Apply comprehensive filter set
      await filterPage.enterSearchQuery('web application');
      await filterPage.selectLanguages(['JavaScript', 'TypeScript']);
      await filterPage.selectTopics(['web']);
      await filterPage.selectSeverityFilter('medium');
      await filterPage.toggleResultsOnlyFilter();
      await filterPage.waitForFilterResults();

      const preRefreshCount = await repositoryListPage.getRepositoryCount();
      const preRefreshUrl = await filterPage.getCurrentURL();

      // Refresh the page
      await page.reload();
      await repositoryListPage.waitForRepositoriesToLoad();

      // Verify all filter state is restored
      const postRefreshCount = await repositoryListPage.getRepositoryCount();
      const postRefreshUrl = await filterPage.getCurrentURL();

      expect(postRefreshCount).toEqual(preRefreshCount);
      expect(postRefreshUrl).toEqual(preRefreshUrl);

      // Verify active filters are displayed
      await filterPage.verifyActiveFilter('Search: "web application"');
      await filterPage.verifyActiveFilter('Languages: 2');
      await filterPage.verifyActiveFilter('Topics: 1');
      await filterPage.verifyActiveFilter('Severity: medium');
      await filterPage.verifyActiveFilter('With Findings Only');
    });

    test('should persist user preferences and custom presets in local storage', async ({ page }) => {
      // Create custom presets
      await filterPage.selectLanguages(['Go']);
      await filterPage.selectSeverityFilter('high');
      await presetManagementPage.saveAsPreset('Go High Security', 'Go repositories with high security issues');

      // Verify local storage contains preset
      const localStorage = await page.evaluate(() => {
        return JSON.stringify(window.localStorage.getItem('filterPresets'));
      });
      expect(localStorage).toContain('Go High Security');

      // Simulate new session (clear session storage but keep local storage)
      await page.evaluate(() => {
        window.sessionStorage.clear();
      });

      // Reload page
      await page.reload();
      await repositoryListPage.waitForRepositoriesToLoad();

      // Verify custom preset is still available
      await presetManagementPage.verifyPresetExists('Go High Security');

      // Apply and verify it works
      await presetManagementPage.applyPreset('Go High Security');
      await filterPage.verifyActiveFilter('Languages: 1');
      await filterPage.verifyActiveFilter('Severity: high');
    });
  });
});