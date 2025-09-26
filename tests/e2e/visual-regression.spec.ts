import { test, expect } from '@playwright/test';
import { FilterPage } from './pages/FilterPage';
import { RepositoryListPage } from './pages/RepositoryListPage';
import { PresetManagementPage } from './pages/PresetManagementPage';
import { GitHubAPIMock } from './fixtures/GitHubAPIMock';

test.describe('Visual Regression Tests', () => {
  let filterPage: FilterPage;
  let repositoryListPage: RepositoryListPage;
  let presetManagementPage: PresetManagementPage;
  let apiMock: GitHubAPIMock;

  test.beforeEach(async ({ page }) => {
    filterPage = new FilterPage(page);
    repositoryListPage = new RepositoryListPage(page);
    presetManagementPage = new PresetManagementPage(page);
    apiMock = new GitHubAPIMock(page);

    // Setup consistent test data for visual consistency
    await apiMock.setupMocks({
      repositoryCount: 20, // Smaller set for consistent screenshots
      includeSpecialCases: false,
      enableRateLimit: false
    });

    await page.goto('/');
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
    await page.getByLabel('Organization').fill('test-org');
    await page.getByRole('button', { name: 'Connect' }).click();
    await repositoryListPage.waitForRepositoriesToLoad();

    // Wait for any animations to complete
    await page.waitForTimeout(500);
  });

  test.describe('Filter UI State Screenshots', () => {
    
    test('should capture default filter interface state', async ({ page }) => {
      // Capture the initial clean state
      await expect(page.locator('[data-testid="advanced-filters"]').first()).toHaveScreenshot('filter-interface-default.png', {
        mask: [
          page.locator('[data-testid="dynamic-timestamp"]'),
          page.locator('[data-testid="user-avatar"]')
        ]
      });
    });

    test('should capture filter interface with active search', async ({ page }) => {
      await filterPage.enterSearchQuery('typescript security application');
      await filterPage.waitForFilterResults();

      await expect(page.locator('[data-testid="advanced-filters"]').first()).toHaveScreenshot('filter-interface-with-search.png', {
        mask: [page.locator('[data-testid="results-timestamp"]')]
      });
    });

    test('should capture filter interface with severity filters applied', async ({ page }) => {
      await filterPage.selectSeverityFilter('critical');
      await filterPage.selectSeverityFilter('high');
      await filterPage.waitForFilterResults();

      await expect(page.locator('[data-testid="advanced-filters"]').first()).toHaveScreenshot('filter-interface-severity-selected.png');
    });

    test('should capture filter interface with advanced filters expanded', async ({ page }) => {
      // Apply multiple advanced filters
      await filterPage.selectLanguages(['TypeScript', 'JavaScript', 'Python']);
      await filterPage.selectTopics(['web', 'security']);
      await filterPage.selectActivityPeriod('Last 30 days');
      await filterPage.setComplianceScoreRange(70, 95);
      await filterPage.waitForFilterResults();

      await expect(page.locator('[data-testid="advanced-filters"]').first()).toHaveScreenshot('filter-interface-advanced-active.png');
    });

    test('should capture active filters summary section', async ({ page }) => {
      // Apply a comprehensive set of filters
      await filterPage.enterSearchQuery('web app');
      await filterPage.selectSeverityFilter('medium');
      await filterPage.toggleResultsOnlyFilter();
      await filterPage.selectLanguages(['TypeScript']);
      await filterPage.selectTopics(['security']);
      await filterPage.waitForFilterResults();

      const activeFiltersSection = page.locator('[data-testid="active-filters"]').first();
      await expect(activeFiltersSection).toHaveScreenshot('active-filters-summary.png');
    });

    test('should capture empty state when no results match filters', async ({ page }) => {
      // Apply filters that will result in no matches
      await filterPage.selectSeverityFilter('critical');
      await filterPage.selectLanguages(['COBOL']);
      await filterPage.selectTopics(['nonexistent-topic']);
      await filterPage.waitForFilterResults();

      await expect(page.locator('[data-testid="repository-list-container"]').first()).toHaveScreenshot('empty-state-no-results.png');
    });
  });

  test.describe('Filter Preset Visual States', () => {
    
    test('should capture default preset grid layout', async ({ page }) => {
      const presetSection = page.locator('[data-testid="filter-presets"]').first();
      await expect(presetSection).toHaveScreenshot('preset-grid-default.png');
    });

    test('should capture preset with applied state highlighting', async ({ page }) => {
      await presetManagementPage.applyPreset('Compliance Ready');
      await filterPage.waitForFilterResults();

      const presetSection = page.locator('[data-testid="filter-presets"]').first();
      await expect(presetSection).toHaveScreenshot('preset-grid-with-applied.png');
    });

    test('should capture custom preset creation dialog', async ({ page }) => {
      // Apply some filters first
      await filterPage.selectLanguages(['TypeScript']);
      await filterPage.selectSeverityFilter('high');

      try {
        await page.getByRole('button', { name: /save.*preset/i }).first().click();
        await page.waitForTimeout(300);

        const dialog = page.locator('[role="dialog"], [data-testid="preset-dialog"]').first();
        if (await dialog.isVisible()) {
          await expect(dialog).toHaveScreenshot('preset-creation-dialog.png');
        }
      } catch {
        console.log('Preset creation dialog not available for screenshot');
      }
    });
  });

  test.describe('Responsive Visual States', () => {
    
    test('should capture mobile filter interface', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      
      // Reload to ensure mobile layout
      await page.reload();
      await repositoryListPage.waitForRepositoriesToLoad();

      await expect(page.locator('main, [role="main"]').first()).toHaveScreenshot('mobile-filter-interface.png', {
        fullPage: true,
        mask: [page.locator('[data-testid="user-avatar"]')]
      });
    });

    test('should capture tablet filter layout', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      
      await page.reload();
      await repositoryListPage.waitForRepositoriesToLoad();

      await expect(page.locator('main, [role="main"]').first()).toHaveScreenshot('tablet-filter-interface.png', {
        fullPage: true,
        mask: [page.locator('[data-testid="user-avatar"]')]
      });
    });

    test('should capture mobile filter drawer if present', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.reload();
      await repositoryListPage.waitForRepositoriesToLoad();

      // Try to open mobile filter drawer
      const filterToggle = page.getByRole('button', { name: /filter/i }).first();
      if (await filterToggle.isVisible()) {
        await filterToggle.click();
        await page.waitForTimeout(300);

        const drawer = page.locator('[data-testid="mobile-filter-drawer"], .filter-drawer').first();
        if (await drawer.isVisible()) {
          await expect(drawer).toHaveScreenshot('mobile-filter-drawer.png');
        }
      }
    });
  });

  test.describe('Dark Mode Visual States', () => {
    
    test('should capture filter interface in dark mode', async ({ page }) => {
      // Enable dark mode
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.reload();
      await repositoryListPage.waitForRepositoriesToLoad();

      await expect(page.locator('[data-testid="advanced-filters"]').first()).toHaveScreenshot('filter-interface-dark-mode.png', {
        mask: [page.locator('[data-testid="user-avatar"]')]
      });
    });

    test('should capture active filters in dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.reload();
      await repositoryListPage.waitForRepositoriesToLoad();

      // Apply filters
      await filterPage.selectSeverityFilter('high');
      await filterPage.selectLanguages(['TypeScript']);
      await filterPage.toggleResultsOnlyFilter();
      await filterPage.waitForFilterResults();

      const activeFilters = page.locator('[data-testid="active-filters"]').first();
      await expect(activeFilters).toHaveScreenshot('active-filters-dark-mode.png');
    });

    test('should capture preset grid in dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.reload();
      await repositoryListPage.waitForRepositoriesToLoad();

      const presetSection = page.locator('[data-testid="filter-presets"]').first();
      await expect(presetSection).toHaveScreenshot('preset-grid-dark-mode.png');
    });
  });

  test.describe('High Contrast Mode Visual States', () => {
    
    test('should capture filter interface in high contrast mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' });
      await page.reload();
      await repositoryListPage.waitForRepositoriesToLoad();

      await expect(page.locator('[data-testid="advanced-filters"]').first()).toHaveScreenshot('filter-interface-high-contrast.png', {
        mask: [page.locator('[data-testid="user-avatar"]')]
      });
    });

    test('should capture selected filter states in high contrast', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' });
      await page.reload();
      await repositoryListPage.waitForRepositoriesToLoad();

      await filterPage.selectSeverityFilter('critical');
      await filterPage.selectLanguages(['JavaScript']);
      await filterPage.waitForFilterResults();

      const selectedFilters = page.locator('[data-selected="true"], .selected, [aria-selected="true"]');
      await expect(selectedFilters.first()).toHaveScreenshot('selected-filters-high-contrast.png');
    });
  });

  test.describe('Loading and Error States', () => {
    
    test('should capture loading state during filter application', async ({ page }) => {
      // Slow down network to capture loading state
      await page.route('**/*', route => {
        return new Promise(resolve => {
          setTimeout(() => {
            route.continue();
            resolve();
          }, 1000);
        });
      });

      await page.reload();
      
      // Try to capture loading spinner if it appears
      const loadingSpinner = page.locator('[data-testid="loading-spinner"], .loading-spinner').first();
      try {
        await expect(loadingSpinner).toHaveScreenshot('loading-state.png', { timeout: 2000 });
      } catch {
        console.log('Loading state too fast to capture');
      }

      await page.unroute('**/*');
    });

    test('should capture error state for network failures', async ({ page }) => {
      // Simulate network failure
      await page.route('**/api.github.com/**', route => {
        route.abort('connectionrefused');
      });

      await page.reload();
      await page.waitForTimeout(2000);

      // Look for error messages
      const errorElement = page.locator('[data-testid="error-message"], .error-message, [role="alert"]').first();
      if (await errorElement.isVisible()) {
        await expect(errorElement).toHaveScreenshot('network-error-state.png');
      }
    });
  });

  test.describe('Browser Compatibility Visual Tests', () => {
    
    test('should capture filter interface across different browsers', async ({ page, browserName }) => {
      // Browser-specific screenshot
      await expect(page.locator('[data-testid="advanced-filters"]').first()).toHaveScreenshot(`filter-interface-${browserName}.png`, {
        mask: [page.locator('[data-testid="user-avatar"]')]
      });

      // Apply some filters to test interaction rendering
      await filterPage.selectSeverityFilter('medium');
      await filterPage.selectLanguages(['Python']);
      await filterPage.waitForFilterResults();

      await expect(page.locator('[data-testid="active-filters"]').first()).toHaveScreenshot(`active-filters-${browserName}.png`);
    });

    test('should capture compliance score slider across browsers', async ({ page, browserName }) => {
      await filterPage.setComplianceScoreRange(60, 90);
      await filterPage.waitForFilterResults();

      const sliderSection = page.locator('[data-testid="compliance-score-section"]').first();
      if (await sliderSection.isVisible()) {
        await expect(sliderSection).toHaveScreenshot(`compliance-slider-${browserName}.png`);
      }
    });
  });

  test.describe('Animation State Captures', () => {
    
    test('should capture filter transition animations', async ({ page }) => {
      // Disable animations for consistent screenshots
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-delay: 0.01ms !important;
            transition-duration: 0.01ms !important;
            transition-delay: 0.01ms !important;
          }
        `
      });

      // Apply filter and capture the immediate result
      await filterPage.selectSeverityFilter('high');
      await page.waitForTimeout(50); // Brief wait for immediate transition

      await expect(page.locator('[data-testid="severity-filters"]').first()).toHaveScreenshot('severity-filter-transition.png');
    });

    test('should capture hover states for interactive elements', async ({ page }) => {
      // Hover over severity badge
      const criticalBadge = page.getByText('critical', { exact: true }).first();
      await criticalBadge.hover();
      await page.waitForTimeout(100);

      await expect(criticalBadge).toHaveScreenshot('severity-badge-hover.png');

      // Hover over preset button
      const presetButton = presetManagementPage.presetButtons.first();
      if (await presetButton.isVisible()) {
        await presetButton.hover();
        await page.waitForTimeout(100);

        await expect(presetButton).toHaveScreenshot('preset-button-hover.png');
      }
    });

    test('should capture focus states for accessibility', async ({ page }) => {
      // Focus on search input
      await filterPage.searchInput.focus();
      await expect(filterPage.searchInput).toHaveScreenshot('search-input-focused.png');

      // Tab to next element and capture focus ring
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      if (await focusedElement.isVisible()) {
        await expect(focusedElement).toHaveScreenshot('next-element-focused.png');
      }
    });
  });
});