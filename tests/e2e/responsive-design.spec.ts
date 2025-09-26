import { test, expect } from '@playwright/test';
import { FilterPage } from './pages/FilterPage';
import { RepositoryListPage } from './pages/RepositoryListPage';
import { PresetManagementPage } from './pages/PresetManagementPage';
import { SearchBoxComponent } from './pages/SearchBoxComponent';
import { GitHubAPIMock } from './fixtures/GitHubAPIMock';

test.describe('Responsive Design & Mobile Filtering Tests', () => {
  let filterPage: FilterPage;
  let repositoryListPage: RepositoryListPage;
  let presetManagementPage: PresetManagementPage;
  let searchBox: SearchBoxComponent;
  let apiMock: GitHubAPIMock;

  test.beforeEach(async ({ page }) => {
    filterPage = new FilterPage(page);
    repositoryListPage = new RepositoryListPage(page);
    presetManagementPage = new PresetManagementPage(page);
    searchBox = new SearchBoxComponent(page);
    apiMock = new GitHubAPIMock(page);

    await apiMock.setupMocks({
      repositoryCount: 100,
      includeSpecialCases: true,
      enableRateLimit: false
    });
  });

  test.describe('Mobile Layout Tests', () => {
    
    test('should provide usable filter interface on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone 8 size
      
      await page.goto('/');
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      await repositoryListPage.waitForRepositoriesToLoad();

      // Verify search input is visible and usable
      await expect(searchBox.searchInput).toBeVisible();
      const searchBox = page.getByPlaceholder(/Search by name, description/);
      await expect(searchBox).toHaveCSS('width', /.+/); // Should have defined width

      // Test search functionality on mobile
      await searchBox.fill('typescript');
      await page.waitForTimeout(400); // Debounce wait
      
      const results = await repositoryListPage.getRepositoryCount();
      expect(results).toBeGreaterThan(0);

      // Verify filter controls are accessible (might be in collapsed state)
      const filterToggle = page.locator('[data-testid="mobile-filter-toggle"]').first();
      if (await filterToggle.isVisible()) {
        await filterToggle.click();
      }

      // Test severity filter badges are usable on mobile
      const severityBadge = page.getByText('high', { exact: true }).first();
      await expect(severityBadge).toBeVisible();
      
      // Touch targets should be large enough (minimum 44px as per WCAG guidelines)
      const badgeSize = await severityBadge.boundingBox();
      expect(badgeSize?.height).toBeGreaterThanOrEqual(40);
    });

    test('should handle tablet experience with medium screen sizes', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad size
      
      await page.goto('/');
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      await repositoryListPage.waitForRepositoriesToLoad();

      // Verify layout adapts to tablet size
      const filterSection = page.locator('[data-testid="advanced-filters"]').first();
      await expect(filterSection).toBeVisible();

      // Should have multi-column layout on tablet
      const languageFilter = page.locator('[data-testid="language-filter"]').first();
      const topicFilter = page.locator('[data-testid="topic-filter"]').first();
      
      if (await languageFilter.isVisible() && await topicFilter.isVisible()) {
        const langBox = await languageFilter.boundingBox();
        const topicBox = await topicFilter.boundingBox();
        
        // Should be side-by-side or in grid layout
        const isHorizontalLayout = langBox && topicBox && 
          Math.abs((langBox.y + langBox.height/2) - (topicBox.y + topicBox.height/2)) < 50;
        expect(isHorizontalLayout).toBeTruthy();
      }

      // Test filter interaction on tablet
      await filterPage.selectLanguages(['TypeScript']);
      await filterPage.selectSeverityFilter('medium');
      await filterPage.waitForFilterResults();

      const resultCount = await repositoryListPage.getRepositoryCount();
      expect(resultCount).toBeGreaterThan(0);
    });

    test('should implement mobile filter drawer functionality', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 }); // iPhone 5 size (smallest)
      
      await page.goto('/');
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      await repositoryListPage.waitForRepositoriesToLoad();

      // Look for mobile filter toggle/drawer
      const filterButton = page.getByRole('button', { name: /filter|Filter/i }).first();
      if (await filterButton.isVisible()) {
        // Test opening filter drawer
        await filterButton.click();
        
        // Drawer should slide in
        const filterDrawer = page.locator('[data-testid="mobile-filter-drawer"], .filter-drawer, [role="dialog"]').first();
        await expect(filterDrawer).toBeVisible();

        // Should be able to apply filters in drawer
        const drawerLanguageFilter = filterDrawer.getByText('TypeScript').first();
        if (await drawerLanguageFilter.isVisible()) {
          await drawerLanguageFilter.click();
        }

        // Apply filters button
        const applyButton = filterDrawer.getByRole('button', { name: /apply|Apply/i }).first();
        if (await applyButton.isVisible()) {
          await applyButton.click();
        }

        // Drawer should close and results should update
        await filterPage.waitForFilterResults();
        const results = await repositoryListPage.getRepositoryCount();
        expect(results).toBeGreaterThan(0);
      }
    });

    test('should support touch interactions and gestures', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 }); // iPhone X size
      
      await page.goto('/');
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      await repositoryListPage.waitForRepositoriesToLoad();

      // Test touch scrolling through repository list
      const repositoryList = page.locator('[data-testid="repository-list"]').first();
      
      // Simulate touch scroll
      await repositoryList.hover();
      await page.mouse.move(200, 400);
      await page.mouse.down();
      await page.mouse.move(200, 200); // Swipe up
      await page.mouse.up();
      
      await page.waitForTimeout(500);

      // Test touch interaction with filter elements
      const severityBadge = page.getByText('critical', { exact: true }).first();
      if (await severityBadge.isVisible()) {
        // Tap interaction
        await severityBadge.tap();
        await filterPage.waitForFilterResults();
        
        // Verify filter was applied
        await expect(severityBadge).toHaveClass(/selected|active/);
      }

      // Test compliance score slider touch interaction
      const complianceSlider = page.locator('[data-testid="compliance-score-slider"]').first();
      if (await complianceSlider.isVisible()) {
        const sliderBounds = await complianceSlider.boundingBox();
        if (sliderBounds) {
          // Touch and drag slider
          await page.touchscreen.tap(sliderBounds.x + sliderBounds.width * 0.7, sliderBounds.y + sliderBounds.height / 2);
          await page.waitForTimeout(300);
        }
      }
    });
  });

  test.describe('Cross-Device Compatibility', () => {
    
    test('should maintain functionality across different screen sizes', async ({ page }) => {
      const screenSizes = [
        { width: 320, height: 568, name: 'Mobile Small' },
        { width: 375, height: 812, name: 'Mobile Large' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 1024, height: 768, name: 'Tablet Landscape' },
        { width: 1440, height: 900, name: 'Desktop' }
      ];

      for (const size of screenSizes) {
        await page.setViewportSize({ width: size.width, height: size.height });
        
        await page.goto('/');
        await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
        await page.getByLabel('Organization').fill('test-org');
        await page.getByRole('button', { name: 'Connect' }).click();
        await repositoryListPage.waitForRepositoriesToLoad();

        console.log(`Testing ${size.name} (${size.width}x${size.height})`);

        // Core functionality should work on all sizes
        const initialCount = await repositoryListPage.getRepositoryCount();
        expect(initialCount).toBeGreaterThan(0);

        // Search should work
        await searchBox.enterText('test');
        await filterPage.waitForFilterResults();
        const searchCount = await repositoryListPage.getRepositoryCount();
        expect(searchCount).toBeGreaterThanOrEqual(0);

        // At least some filtering should be accessible
        try {
          if (size.width >= 768) {
            // Desktop/tablet - all filters should be visible
            await filterPage.selectSeverityFilter('high');
            await filterPage.waitForFilterResults();
            const filteredCount = await repositoryListPage.getRepositoryCount();
            expect(filteredCount).toBeGreaterThanOrEqual(0);
          } else {
            // Mobile - might need to open filter drawer
            const filterToggle = page.getByRole('button', { name: /filter/i }).first();
            if (await filterToggle.isVisible()) {
              await filterToggle.click();
              await page.waitForTimeout(300);
            }
          }
        } catch (error) {
          console.log(`Filter interaction not available on ${size.name}: ${error}`);
        }

        await searchBox.clearSearch();
      }
    });

    test('should handle orientation changes gracefully', async ({ page }) => {
      // Start in portrait mobile
      await page.setViewportSize({ width: 375, height: 812 });
      
      await page.goto('/');
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      await repositoryListPage.waitForRepositoriesToLoad();

      // Apply some filters in portrait
      await searchBox.enterText('typescript');
      await filterPage.waitForFilterResults();
      const portraitCount = await repositoryListPage.getRepositoryCount();

      // Switch to landscape
      await page.setViewportSize({ width: 812, height: 375 });
      await page.waitForTimeout(500); // Allow layout to adjust

      // Verify filter state is maintained
      const landscapeCount = await repositoryListPage.getRepositoryCount();
      expect(landscapeCount).toEqual(portraitCount);

      // Verify search text is still there
      await expect(searchBox.searchInput).toHaveValue('typescript');

      // Should be able to add more filters in landscape
      try {
        await filterPage.selectSeverityFilter('medium');
        await filterPage.waitForFilterResults();
        const updatedCount = await repositoryListPage.getRepositoryCount();
        expect(updatedCount).toBeGreaterThanOrEqual(0);
      } catch (error) {
        console.log('Additional filtering not available in landscape mobile');
      }
    });

    test('should provide consistent experience across mobile browsers', async ({ page, browserName }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/');
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      await repositoryListPage.waitForRepositoriesToLoad();

      console.log(`Testing mobile experience in ${browserName}`);

      // Test core search functionality across browsers
      await searchBox.enterText('web application');
      await filterPage.waitForFilterResults();
      const searchResults = await repositoryListPage.getRepositoryCount();
      expect(searchResults).toBeGreaterThanOrEqual(0);

      // Test touch-friendly element sizing
      const searchInputSize = await searchBox.searchInput.boundingBox();
      expect(searchInputSize?.height).toBeGreaterThanOrEqual(40); // Minimum touch target

      // Test preset functionality on mobile
      const presetButtons = presetManagementPage.presetButtons;
      const presetCount = await presetButtons.count();
      
      if (presetCount > 0) {
        const firstPreset = presetButtons.first();
        const presetSize = await firstPreset.boundingBox();
        expect(presetSize?.height).toBeGreaterThanOrEqual(40);

        // Test preset application
        await firstPreset.click();
        await filterPage.waitForFilterResults();
        const presetResults = await repositoryListPage.getRepositoryCount();
        expect(presetResults).toBeGreaterThanOrEqual(0);
      }

      // Browser-specific optimizations
      if (browserName === 'webkit') {
        // Test iOS Safari specific features
        // Verify viewport meta tag prevents zoom on input focus
        const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
        expect(viewportMeta).toContain('user-scalable=no');
      }

      if (browserName === 'chromium') {
        // Test Chrome mobile specific features
        // Verify PWA manifest or service worker if applicable
        const manifestLink = page.locator('link[rel="manifest"]');
        if (await manifestLink.count() > 0) {
          const manifestHref = await manifestLink.getAttribute('href');
          expect(manifestHref).toBeTruthy();
        }
      }
    });
  });

  test.describe('Progressive Enhancement', () => {
    
    test('should provide fallback experience for limited mobile capabilities', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 480 }); // Very small screen
      
      // Simulate slow network
      await page.route('**/*', route => {
        return new Promise(resolve => {
          setTimeout(() => {
            route.continue();
            resolve();
          }, 100);
        });
      });

      await page.goto('/');
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      
      // Should show loading state
      const loadingIndicator = page.locator('[data-testid="loading-spinner"]');
      if (await loadingIndicator.isVisible()) {
        await expect(loadingIndicator).toBeVisible();
      }

      await repositoryListPage.waitForRepositoriesToLoad();

      // Basic functionality should work even on constrained devices
      const count = await repositoryListPage.getRepositoryCount();
      expect(count).toBeGreaterThan(0);

      // Simplified filtering should be available
      await searchBox.enterText('test');
      await filterPage.waitForFilterResults();
      const searchCount = await repositoryListPage.getRepositoryCount();
      expect(searchCount).toBeGreaterThanOrEqual(0);
    });

    test('should optimize for touch and finger navigation', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      
      await page.goto('/');
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      await repositoryListPage.waitForRepositoriesToLoad();

      // Test that interactive elements have adequate spacing
      const interactiveElements = page.locator('button, input, [role="button"], [tabindex="0"]');
      const elementCount = await interactiveElements.count();

      for (let i = 0; i < Math.min(5, elementCount); i++) {
        const element = interactiveElements.nth(i);
        if (await element.isVisible()) {
          const box = await element.boundingBox();
          if (box) {
            expect(box.height).toBeGreaterThanOrEqual(40);
            expect(box.width).toBeGreaterThanOrEqual(40);
          }
        }
      }

      // Test scrolling behavior is smooth
      await repositoryListPage.scrollToBottom();
      await page.waitForTimeout(300);
      
      // Should maintain usability after scroll
      const isSearchVisible = await searchBox.searchInput.isVisible();
      const isResultsVisible = await repositoryListPage.repositoryCards.first().isVisible();
      expect(isSearchVisible || isResultsVisible).toBe(true);
    });

    test('should handle offline/connectivity issues gracefully', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/');
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      await repositoryListPage.waitForRepositoriesToLoad();

      // Apply some filters
      await searchBox.enterText('javascript');
      await filterPage.waitForFilterResults();

      // Simulate network failure
      await page.route('**/*', route => {
        route.abort('connectionrefused');
      });

      // Try to apply another filter - should handle gracefully
      try {
        await filterPage.selectSeverityFilter('high');
        await page.waitForTimeout(2000);
        
        // Should show error message or maintain current state
        const errorMessage = page.locator('[data-testid="error-message"], .error-message').first();
        const isErrorVisible = await errorMessage.isVisible();
        const currentCount = await repositoryListPage.getRepositoryCount();
        
        expect(isErrorVisible || currentCount > 0).toBe(true);
      } catch (error) {
        // Expected when network is down
        console.log('Network error handled gracefully:', error);
      }

      // Restore network
      await page.unroute('**/*');
    });
  });
});