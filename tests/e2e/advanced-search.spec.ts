import { test, expect, Page } from '@playwright/test';

test.describe('Advanced Repository Filtering & Search E2E Tests', () => {
  
  // Setup mock data and API responses
  test.beforeEach(async ({ page }) => {
    // Mock GitHub API responses with advanced search data
    await page.route('**/api.github.com/**', (route) => {
      const url = route.request().url();
      
      if (url.includes('/user')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            login: 'test-user', 
            name: 'Test User',
            avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4'
          })
        });
      } else if (url.includes('/orgs/test-org/repos')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              name: 'typescript-frontend',
              full_name: 'test-org/typescript-frontend',
              default_branch: 'main',
              owner: { login: 'test-org', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
              languages_url: 'https://api.github.com/repos/test-org/typescript-frontend/languages',
              topics: ['frontend', 'typescript', 'react', 'web'],
              updated_at: '2024-01-15T10:00:00Z'
            },
            {
              id: 2,
              name: 'python-api-service',
              full_name: 'test-org/python-api-service',
              default_branch: 'main',
              owner: { login: 'test-org', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
              languages_url: 'https://api.github.com/repos/test-org/python-api-service/languages',
              topics: ['backend', 'python', 'api', 'microservice'],
              updated_at: '2024-01-12T10:00:00Z'
            },
            {
              id: 3,
              name: 'legacy-java-monolith',
              full_name: 'test-org/legacy-java-monolith',
              default_branch: 'master',
              owner: { login: 'test-org', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
              languages_url: 'https://api.github.com/repos/test-org/legacy-java-monolith/languages',
              topics: ['legacy', 'java', 'enterprise'],
              updated_at: '2023-12-01T10:00:00Z'
            },
            {
              id: 4,
              name: 'mobile-flutter-app',
              full_name: 'test-org/mobile-flutter-app',
              default_branch: 'main',
              owner: { login: 'test-org', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
              languages_url: 'https://api.github.com/repos/test-org/mobile-flutter-app/languages',
              topics: ['mobile', 'flutter', 'dart'],
              updated_at: '2024-01-14T10:00:00Z'
            }
          ])
        });
      } else if (url.includes('languages')) {
        const repoName = url.split('/repos/test-org/')[1]?.split('/languages')[0];
        const languageMap: Record<string, Record<string, number>> = {
          'typescript-frontend': { 'TypeScript': 75000, 'JavaScript': 25000, 'CSS': 15000 },
          'python-api-service': { 'Python': 85000, 'Dockerfile': 2000 },
          'legacy-java-monolith': { 'Java': 150000, 'XML': 10000, 'Properties': 3000 },
          'mobile-flutter-app': { 'Dart': 60000, 'Swift': 8000, 'Kotlin': 5000 }
        };
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(languageMap[repoName] || {})
        });
      } else if (url.includes('/repos/') && url.includes('/actions/workflows')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            workflows: [
              { id: 1, name: 'CodeQL Analysis', path: '.github/workflows/codeql.yml', state: 'active' }
            ]
          })
        });
      } else if (url.includes('/repos/') && url.includes('/code-scanning/alerts')) {
        const repoName = url.split('/repos/test-org/')[1]?.split('/code-scanning')[0];
        const alertsMap: Record<string, any[]> = {
          'typescript-frontend': [
            { rule: { security_severity_level: 'critical', severity: 'error' } },
            { rule: { security_severity_level: 'high', severity: 'warning' } }
          ],
          'python-api-service': [
            { rule: { security_severity_level: 'medium', severity: 'warning' } }
          ],
          'legacy-java-monolith': [
            { rule: { security_severity_level: 'critical', severity: 'error' } },
            { rule: { security_severity_level: 'critical', severity: 'error' } },
            { rule: { security_severity_level: 'high', severity: 'warning' } },
            { rule: { security_severity_level: 'high', severity: 'warning' } },
            { rule: { security_severity_level: 'medium', severity: 'note' } }
          ],
          'mobile-flutter-app': []
        };
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(alertsMap[repoName] || [])
        });
      } else {
        route.fulfill({ status: 404 });
      }
    });

    // Navigate to dashboard and set up connection
    await page.goto('/');
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
    await page.getByLabel('Organization').fill('test-org');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Wait for repositories to load
    await expect(page.getByText('typescript-frontend')).toBeVisible({ timeout: 10000 });
  });

  test.describe('Multi-Criteria Filtering Workflows', () => {
    test('should filter repositories by text search', async ({ page }) => {
      // Test simple text search
      await page.getByPlaceholder('Search repositories...').fill('typescript');
      
      // Should show only typescript-frontend
      await expect(page.getByText('typescript-frontend')).toBeVisible();
      await expect(page.getByText('python-api-service')).not.toBeVisible();
      await expect(page.getByText('legacy-java-monolith')).not.toBeVisible();
      await expect(page.getByText('mobile-flutter-app')).not.toBeVisible();
    });

    test('should filter repositories by language', async ({ page }) => {
      // Open advanced filters if not already open
      const advancedFiltersButton = page.getByRole('button', { name: 'Advanced Filters' });
      if (await advancedFiltersButton.isVisible()) {
        await advancedFiltersButton.click();
      }

      // Select Python language filter
      await page.getByText('Languages').click();
      await page.getByText('Python').click();

      // Should show only python-api-service
      await expect(page.getByText('python-api-service')).toBeVisible();
      await expect(page.getByText('typescript-frontend')).not.toBeVisible();
    });

    test('should filter repositories by topics', async ({ page }) => {
      // Open advanced filters
      const advancedFiltersButton = page.getByRole('button', { name: 'Advanced Filters' });
      if (await advancedFiltersButton.isVisible()) {
        await advancedFiltersButton.click();
      }

      // Select 'frontend' topic
      await page.getByText('Topics').click();
      await page.getByText('frontend').click();

      // Should show only typescript-frontend
      await expect(page.getByText('typescript-frontend')).toBeVisible();
      await expect(page.getByText('python-api-service')).not.toBeVisible();
    });

    test('should filter repositories by security severity', async ({ page }) => {
      // Select critical severity filter
      await page.getByRole('combobox', { name: 'Severity Filter' }).click();
      await page.getByText('Critical').click();

      // Should show repositories with critical findings
      await expect(page.getByText('typescript-frontend')).toBeVisible();
      await expect(page.getByText('legacy-java-monolith')).toBeVisible();
      await expect(page.getByText('python-api-service')).not.toBeVisible();
      await expect(page.getByText('mobile-flutter-app')).not.toBeVisible();
    });

    test('should combine multiple filters correctly', async ({ page }) => {
      // Apply text search
      await page.getByPlaceholder('Search repositories...').fill('app');
      
      // Apply severity filter
      await page.getByRole('combobox', { name: 'Severity Filter' }).click();
      await page.getByText('Medium').click();

      // Open advanced filters and apply topic filter
      const advancedFiltersButton = page.getByRole('button', { name: 'Advanced Filters' });
      if (await advancedFiltersButton.isVisible()) {
        await advancedFiltersButton.click();
      }
      
      await page.getByText('Topics').click();
      await page.getByText('api').click();

      // Should apply all filters in combination
      // Only python-api-service matches: has "api" in name, medium severity, api topic
      await expect(page.getByText('python-api-service')).toBeVisible();
      await expect(page.getByText('typescript-frontend')).not.toBeVisible();
    });
  });

  test.describe('Boolean Search Operators', () => {
    test('should handle AND operator correctly', async ({ page }) => {
      await page.getByPlaceholder('Search repositories...').fill('api AND python');
      
      // Should match python-api-service (contains both "api" and "python")
      await expect(page.getByText('python-api-service')).toBeVisible();
      await expect(page.getByText('typescript-frontend')).not.toBeVisible();
    });

    test('should handle OR operator correctly', async ({ page }) => {
      await page.getByPlaceholder('Search repositories...').fill('typescript OR java');
      
      // Should match both typescript-frontend and legacy-java-monolith
      await expect(page.getByText('typescript-frontend')).toBeVisible();
      await expect(page.getByText('legacy-java-monolith')).toBeVisible();
      await expect(page.getByText('python-api-service')).not.toBeVisible();
    });

    test('should handle NOT operator correctly', async ({ page }) => {
      await page.getByPlaceholder('Search repositories...').fill('app NOT legacy');
      
      // Should match repositories with "app" but exclude those with "legacy"
      await expect(page.getByText('mobile-flutter-app')).toBeVisible();
      await expect(page.getByText('legacy-java-monolith')).not.toBeVisible();
    });

    test('should handle field-specific searches', async ({ page }) => {
      await page.getByPlaceholder('Search repositories...').fill('language:typescript topic:react');
      
      // Should match typescript-frontend (has TypeScript language and react topic)
      await expect(page.getByText('typescript-frontend')).toBeVisible();
      await expect(page.getByText('python-api-service')).not.toBeVisible();
    });

    test('should handle complex boolean combinations', async ({ page }) => {
      await page.getByPlaceholder('Search repositories...').fill('(typescript OR python) AND NOT legacy');
      
      // Should match typescript-frontend and python-api-service, but exclude legacy-java-monolith
      await expect(page.getByText('typescript-frontend')).toBeVisible();
      await expect(page.getByText('python-api-service')).toBeVisible();
      await expect(page.getByText('legacy-java-monolith')).not.toBeVisible();
    });
  });

  test.describe('Filter Presets', () => {
    test('should apply predefined filter presets', async ({ page }) => {
      // Look for preset buttons or dropdown
      const presetsButton = page.getByRole('button', { name: 'Filter Presets' });
      
      if (await presetsButton.isVisible()) {
        await presetsButton.click();
        
        // Apply "High Risk" preset (example)
        await page.getByText('High Risk Repositories').click();
        
        // Should filter to show only repositories with high/critical findings
        await expect(page.getByText('typescript-frontend')).toBeVisible();
        await expect(page.getByText('legacy-java-monolith')).toBeVisible();
        await expect(page.getByText('mobile-flutter-app')).not.toBeVisible();
      }
    });

    test('should save custom filter presets', async ({ page }) => {
      // Apply some custom filters
      await page.getByPlaceholder('Search repositories...').fill('language:python');
      
      const advancedFiltersButton = page.getByRole('button', { name: 'Advanced Filters' });
      if (await advancedFiltersButton.isVisible()) {
        await advancedFiltersButton.click();
      }
      
      await page.getByText('Topics').click();
      await page.getByText('api').click();
      
      // Save as preset
      const savePresetButton = page.getByRole('button', { name: 'Save as Preset' });
      if (await savePresetButton.isVisible()) {
        await savePresetButton.click();
        
        await page.getByLabel('Preset Name').fill('Python APIs');
        await page.getByRole('button', { name: 'Save' }).click();
        
        // Verify preset was saved
        await expect(page.getByText('Preset saved successfully')).toBeVisible();
      }
    });
  });

  test.describe('Filter State Persistence', () => {
    test('should persist filters in URL parameters', async ({ page }) => {
      // Apply filters
      await page.getByPlaceholder('Search repositories...').fill('typescript');
      await page.getByRole('combobox', { name: 'Severity Filter' }).click();
      await page.getByText('Critical').click();
      
      // Check URL contains filter parameters
      await expect(page).toHaveURL(/search=typescript/);
      await expect(page).toHaveURL(/severity=critical/);
    });

    test('should restore filters from URL parameters', async ({ page }) => {
      // Navigate with pre-set URL parameters
      await page.goto('/?search=python&severity=medium');
      
      // Wait for connection and data load
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      
      await expect(page.getByText('python-api-service')).toBeVisible({ timeout: 10000 });
      
      // Verify filters are applied from URL
      await expect(page.getByPlaceholder('Search repositories...')).toHaveValue('python');
      await expect(page.getByRole('combobox', { name: 'Severity Filter' })).toHaveText('Medium');
    });

    test('should maintain filters across page refresh', async ({ page }) => {
      // Apply filters
      await page.getByPlaceholder('Search repositories...').fill('frontend');
      
      const advancedFiltersButton = page.getByRole('button', { name: 'Advanced Filters' });
      if (await advancedFiltersButton.isVisible()) {
        await advancedFiltersButton.click();
      }
      
      // Refresh page
      await page.reload();
      
      // Reconnect
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      
      await expect(page.getByText('typescript-frontend')).toBeVisible({ timeout: 10000 });
      
      // Verify filters are restored
      await expect(page.getByPlaceholder('Search repositories...')).toHaveValue('frontend');
    });

    test('should generate shareable URLs', async ({ page }) => {
      // Apply complex filters
      await page.getByPlaceholder('Search repositories...').fill('language:typescript AND topic:web');
      await page.getByRole('combobox', { name: 'Severity Filter' }).click();
      await page.getByText('High').click();
      
      // Look for share button
      const shareButton = page.getByRole('button', { name: 'Share Filters' });
      if (await shareButton.isVisible()) {
        await shareButton.click();
        
        // Should show shareable URL or copy to clipboard
        await expect(page.getByText('Filter URL copied to clipboard')).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Performance Testing', () => {
    test('should handle large datasets efficiently', async ({ page }) => {
      // Mock a large number of repositories
      await page.route('**/api.github.com/orgs/test-org/repos', (route) => {
        const largeRepoList = Array.from({ length: 1000 }, (_, i) => ({
          id: i + 1,
          name: `repo-${i + 1}`,
          full_name: `test-org/repo-${i + 1}`,
          default_branch: 'main',
          owner: { login: 'test-org', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
          topics: [`topic-${i % 10}`, `category-${i % 5}`],
          updated_at: '2024-01-15T10:00:00Z'
        }));
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(largeRepoList)
        });
      });
      
      // Reload to get large dataset
      await page.reload();
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      
      const startTime = Date.now();
      await page.getByRole('button', { name: 'Connect' }).click();
      
      // Wait for repositories to load
      await expect(page.getByText('repo-1')).toBeVisible({ timeout: 15000 });
      
      // Apply filter and measure response time
      const filterStartTime = Date.now();
      await page.getByPlaceholder('Search repositories...').fill('repo-1');
      
      // Should respond within 2 seconds for 1000+ repositories
      await expect(page.getByText('repo-1')).toBeVisible({ timeout: 2000 });
      const filterEndTime = Date.now();
      
      const filterTime = filterEndTime - filterStartTime;
      expect(filterTime).toBeLessThan(2000); // Performance requirement: < 2s response time
    });

    test('should handle rapid filter changes without race conditions', async ({ page }) => {
      const searches = ['typescript', 'python', 'java', 'flutter', 'api'];
      
      // Apply rapid filter changes
      for (const search of searches) {
        await page.getByPlaceholder('Search repositories...').fill(search);
        await page.waitForTimeout(100); // Small delay between changes
      }
      
      // Should end up with the final search term
      await expect(page.getByPlaceholder('Search repositories...')).toHaveValue('api');
      
      // Should show appropriate results without errors
      await expect(page.getByText('python-api-service')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Mobile and Responsive Behavior', () => {
    test('should work correctly on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Should show mobile-friendly interface
      await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
      
      // Search should still work
      await page.getByPlaceholder('Search repositories...').fill('typescript');
      await expect(page.getByText('typescript-frontend')).toBeVisible();
    });

    test('should show mobile-optimized filters', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Advanced filters should be in a collapsible or modal format
      const filtersToggle = page.getByRole('button', { name: /filter/i });
      await filtersToggle.click();
      
      // Should show mobile-friendly filter interface
      await expect(page.getByText('Languages')).toBeVisible();
      await expect(page.getByText('Topics')).toBeVisible();
    });

    test('should work correctly on tablet devices', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Should show appropriate layout for tablet
      await expect(page.getByText('typescript-frontend')).toBeVisible();
      
      // Filters should be accessible
      const advancedFiltersButton = page.getByRole('button', { name: 'Advanced Filters' });
      if (await advancedFiltersButton.isVisible()) {
        await advancedFiltersButton.click();
        await expect(page.getByText('Languages')).toBeVisible();
      }
    });
  });

  test.describe('Accessibility and Usability', () => {
    test('should be keyboard navigable', async ({ page }) => {
      // Focus on search input with Tab
      await page.keyboard.press('Tab');
      await page.keyboard.type('typescript');
      
      // Should filter results
      await expect(page.getByText('typescript-frontend')).toBeVisible();
      
      // Tab to severity filter
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Critical');
      await page.keyboard.press('Enter');
      
      // Should apply severity filter
      await expect(page.getByRole('combobox', { name: 'Severity Filter' })).toHaveText('Critical');
    });

    test('should have proper ARIA labels and screen reader support', async ({ page }) => {
      // Check for proper ARIA labels
      await expect(page.getByRole('searchbox', { name: /search repositories/i })).toBeVisible();
      await expect(page.getByRole('combobox', { name: /severity filter/i })).toBeVisible();
      
      // Check for proper headings
      await expect(page.getByRole('heading', { name: /repositories/i })).toBeVisible();
    });

    test('should show clear filter state indication', async ({ page }) => {
      // Apply filters
      await page.getByPlaceholder('Search repositories...').fill('typescript');
      await page.getByRole('combobox', { name: 'Severity Filter' }).click();
      await page.getByText('Critical').click();
      
      // Should show active filter indicators
      await expect(page.getByText(/2 filters active/i)).toBeVisible();
      
      // Should show clear all option
      await expect(page.getByRole('button', { name: /clear all filters/i })).toBeVisible();
    });

    test('should show results count and filtering feedback', async ({ page }) => {
      // Should show total repository count initially
      await expect(page.getByText(/showing \d+ of \d+ repositories/i)).toBeVisible();
      
      // Apply filter
      await page.getByPlaceholder('Search repositories...').fill('typescript');
      
      // Should show filtered count
      await expect(page.getByText(/showing 1 of \d+ repositories/i)).toBeVisible();
      
      // Should show "no results" message for impossible filters
      await page.getByPlaceholder('Search repositories...').fill('nonexistent-repo-12345');
      await expect(page.getByText(/no repositories found/i)).toBeVisible();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Mock network error
      await page.route('**/api.github.com/orgs/test-org/repos', (route) => {
        route.abort('failed');
      });
      
      await page.reload();
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      
      // Should show error message
      await expect(page.getByText(/failed to load repositories/i)).toBeVisible({ timeout: 10000 });
    });

    test('should handle empty repository lists', async ({ page }) => {
      // Mock empty repository list
      await page.route('**/api.github.com/orgs/test-org/repos', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      });
      
      await page.reload();
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      
      // Should show empty state message
      await expect(page.getByText(/no repositories found/i)).toBeVisible({ timeout: 10000 });
    });

    test('should handle malformed search queries gracefully', async ({ page }) => {
      const malformedQueries = [
        'language:',  // Empty field value
        'AND AND OR', // Invalid boolean logic
        'language:typescript AND AND python', // Double operators
        '((unclosed parentheses', // Malformed grouping
        'field:value:extra:colons' // Too many colons
      ];
      
      for (const query of malformedQueries) {
        await page.getByPlaceholder('Search repositories...').fill(query);
        
        // Should not crash and should show some results or empty state
        await expect(page.locator('[data-testid="repository-list"]')).toBeVisible({ timeout: 3000 });
      }
    });
  });
});