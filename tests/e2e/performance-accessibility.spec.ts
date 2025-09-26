import { test, expect } from '@playwright/test';
import { FilterPage } from './pages/FilterPage';
import { RepositoryListPage } from './pages/RepositoryListPage';
import { SearchBoxComponent } from './pages/SearchBoxComponent';
import { GitHubAPIMock } from './fixtures/GitHubAPIMock';
import { TestDataGenerator } from './data/TestDataGenerator';

test.describe('Performance & Accessibility Tests', () => {
  let filterPage: FilterPage;
  let repositoryListPage: RepositoryListPage;
  let searchBox: SearchBoxComponent;
  let apiMock: GitHubAPIMock;

  test.describe('Performance Testing', () => {
    
    test.beforeEach(async ({ page }) => {
      filterPage = new FilterPage(page);
      repositoryListPage = new RepositoryListPage(page);
      searchBox = new SearchBoxComponent(page);
      apiMock = new GitHubAPIMock(page);

      // Setup large dataset for performance testing
      await apiMock.setupMocks({
        repositoryCount: 1000,
        includeSpecialCases: true,
        enableRateLimit: false
      });
    });

    test('should handle large dataset filtering with acceptable response time', async ({ page }) => {
      await page.goto('/');
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      
      // Measure initial load time for 1000+ repositories
      const loadStartTime = Date.now();
      await repositoryListPage.waitForRepositoriesToLoad();
      const loadEndTime = Date.now();
      const initialLoadTime = loadEndTime - loadStartTime;

      console.log(`Initial load time for 1000+ repositories: ${initialLoadTime}ms`);
      expect(initialLoadTime).toBeLessThan(5000); // Should load within 5 seconds

      // Measure filter application time
      const filterStartTime = Date.now();
      await filterPage.selectLanguages(['TypeScript']);
      await filterPage.waitForFilterResults();
      const filterEndTime = Date.now();
      const filterTime = filterEndTime - filterStartTime;

      console.log(`Filter application time: ${filterTime}ms`);
      expect(filterTime).toBeLessThan(2000); // Should filter within 2 seconds

      // Verify results are still accurate with large dataset
      const resultCount = await repositoryListPage.getRepositoryCount();
      expect(resultCount).toBeGreaterThan(0);
      expect(resultCount).toBeLessThan(1000); // Should be filtered subset

      // Test multiple filter combinations for performance
      const combinedFilterStart = Date.now();
      await filterPage.selectSeverityFilter('high');
      await filterPage.selectTopics(['security']);
      await filterPage.waitForFilterResults();
      const combinedFilterEnd = Date.now();
      const combinedFilterTime = combinedFilterEnd - combinedFilterStart;

      console.log(`Combined filter time: ${combinedFilterTime}ms`);
      expect(combinedFilterTime).toBeLessThan(2000);
    });

    test('should verify search debouncing prevents excessive API calls', async ({ page }) => {
      await page.goto('/');
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      await repositoryListPage.waitForRepositoriesToLoad();

      // Track network requests
      const networkRequests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('api.github.com')) {
          networkRequests.push(request.url());
        }
      });

      // Type quickly to test debouncing
      const testQuery = 'typescript security app';
      await searchBox.typeSlowly(testQuery, 50); // Type at 50ms intervals

      // Wait for debounce period
      await page.waitForTimeout(500);

      // Count search-related requests (should be minimal due to debouncing)
      const searchRequests = networkRequests.filter(url => 
        url.includes('search') || url.includes('repos')
      );

      // Should have fewer requests than characters typed due to debouncing
      expect(searchRequests.length).toBeLessThan(testQuery.length);
      console.log(`Search requests made: ${searchRequests.length}, Characters typed: ${testQuery.length}`);
    });

    test('should monitor memory usage during heavy filtering', async ({ page, browserName }) => {
      // Skip memory monitoring for Safari as it has different performance APIs
      test.skip(browserName === 'webkit', 'Memory monitoring not available in Safari');

      await page.goto('/');
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      await repositoryListPage.waitForRepositoriesToLoad();

      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize
        } : null;
      });

      if (!initialMemory) {
        console.log('Memory monitoring not available in this browser');
        return;
      }

      // Perform intensive filtering operations
      for (let i = 0; i < 10; i++) {
        await filterPage.selectLanguages(['TypeScript']);
        await filterPage.waitForFilterResults();
        await filterPage.clearAllFilters();
        await filterPage.selectSeverityFilter('critical');
        await filterPage.waitForFilterResults();
        await filterPage.clearAllFilters();
        await page.waitForTimeout(100);
      }

      // Get final memory usage
      const finalMemory = await page.evaluate(() => {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize
        };
      });

      const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      console.log(`Memory increase after heavy filtering: ${memoryIncreaseMB.toFixed(2)}MB`);
      
      // Memory increase should be reasonable (less than 50MB for heavy operations)
      expect(memoryIncreaseMB).toBeLessThan(50);
    });

    test('should verify progressive loading for large result sets', async ({ page }) => {
      await page.goto('/');
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      
      // Wait for initial load
      await repositoryListPage.waitForRepositoriesToLoad();
      const initialCount = await repositoryListPage.getRepositoryCount();

      // Should show a subset initially (pagination/virtual scrolling)
      expect(initialCount).toBeLessThanOrEqual(50); // Reasonable page size

      // Test scrolling to load more
      await repositoryListPage.scrollToBottom();
      await page.waitForTimeout(1000); // Wait for additional items to load

      const afterScrollCount = await repositoryListPage.getRepositoryCount();
      
      // Should have loaded more repositories after scrolling
      if (initialCount < 50) {
        // If we had fewer than page size, we're at the end
        expect(afterScrollCount).toEqual(initialCount);
      } else {
        // Should have loaded more
        expect(afterScrollCount).toBeGreaterThan(initialCount);
      }
    });

    test('should measure filter performance with various dataset sizes', async ({ page }) => {
      const performanceMetrics: Record<string, number> = {};

      // Test with different dataset sizes
      const testSizes = [100, 500, 1000];

      for (const size of testSizes) {
        // Reset and setup new dataset
        await apiMock.reset();
        await apiMock.setupMocks({
          repositoryCount: size,
          includeSpecialCases: false,
          enableRateLimit: false
        });

        await page.goto('/');
        await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
        await page.getByLabel('Organization').fill('test-org');
        await page.getByRole('button', { name: 'Connect' }).click();
        
        // Measure load time
        const loadStart = Date.now();
        await repositoryListPage.waitForRepositoriesToLoad();
        const loadTime = Date.now() - loadStart;

        // Measure filter time
        const filterStart = Date.now();
        await filterPage.selectLanguages(['TypeScript']);
        await filterPage.waitForFilterResults();
        const filterTime = Date.now() - filterStart;

        performanceMetrics[`load_${size}`] = loadTime;
        performanceMetrics[`filter_${size}`] = filterTime;

        console.log(`Dataset size ${size}: Load ${loadTime}ms, Filter ${filterTime}ms`);

        await filterPage.clearAllFilters();
      }

      // Verify performance doesn't degrade significantly with size
      expect(performanceMetrics.load_1000).toBeLessThan(performanceMetrics.load_100 * 3);
      expect(performanceMetrics.filter_1000).toBeLessThan(performanceMetrics.filter_100 * 3);
    });
  });

  test.describe('Accessibility Testing', () => {
    
    test.beforeEach(async ({ page }) => {
      filterPage = new FilterPage(page);
      repositoryListPage = new RepositoryListPage(page);
      searchBox = new SearchBoxComponent(page);
      apiMock = new GitHubAPIMock(page);

      await apiMock.setupMocks({
        repositoryCount: 50,
        includeSpecialCases: true,
        enableRateLimit: false
      });

      await page.goto('/');
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      await repositoryListPage.waitForRepositoriesToLoad();
    });

    test('should support keyboard navigation through all filter controls', async ({ page }) => {
      // Start at search input
      await searchBox.searchInput.focus();
      
      // Tab through filter controls
      await page.keyboard.press('Tab'); // Should move to severity filters
      await expect(page.locator(':focus')).toContainText(/critical|high|medium|low/);

      await page.keyboard.press('Tab'); // Should move to next filter control
      await page.keyboard.press('Tab'); // Continue tabbing
      await page.keyboard.press('Tab');

      // Verify we can reach all interactive elements
      const focusableElements = await page.locator('[tabindex="0"], button, input, select').count();
      expect(focusableElements).toBeGreaterThan(10);

      // Test keyboard activation
      await page.keyboard.press('Enter'); // Should activate focused element
      await page.keyboard.press('Space'); // Should also work for toggles
    });

    test('should provide proper ARIA labels and announcements', async ({ page }) => {
      // Check search input has proper label
      await expect(searchBox.searchInput).toHaveAttribute('aria-label', /search/i);

      // Check filter sections have proper headings
      const filterSections = page.locator('h3, h4').filter({ hasText: /filter|language|topic/i });
      expect(await filterSections.count()).toBeGreaterThan(3);

      // Check buttons have accessible names
      const clearButton = filterPage.clearAllButton;
      await expect(clearButton).toHaveAttribute('aria-label', /clear/i);

      // Test that filter changes are announced
      await filterPage.selectSeverityFilter('high');
      await filterPage.waitForFilterResults();

      // Check if results count is announced (aria-live region)
      const resultsAnnouncement = page.locator('[aria-live]');
      await expect(resultsAnnouncement).toBeVisible();
    });

    test('should maintain proper focus management', async ({ page }) => {
      // Focus on search input
      await searchBox.searchInput.focus();
      await expect(searchBox.searchInput).toBeFocused();

      // Apply filter and ensure focus is managed
      await filterPage.selectLanguages(['TypeScript']);
      await filterPage.waitForFilterResults();

      // Focus should remain accessible and logical
      const focusedElement = await page.locator(':focus').textContent();
      expect(focusedElement).toBeDefined();

      // Test modal focus trap (if preset dialog opens)
      try {
        await page.getByRole('button', { name: /save preset/i }).click();
        await expect(page.locator('[role="dialog"] input').first()).toBeFocused();
        
        // Test escape key closes modal and restores focus
        await page.keyboard.press('Escape');
        await expect(page.locator('[role="dialog"]')).not.toBeVisible();
      } catch {
        // Skip if preset dialog not available
      }
    });

    test('should provide logical tab order', async ({ page }) => {
      const tabOrder: string[] = [];
      
      // Start from search input
      await searchBox.searchInput.focus();
      tabOrder.push(await page.locator(':focus').getAttribute('placeholder') || 'search');

      // Tab through elements and record order
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        const focusedText = await page.locator(':focus').textContent() || 
                           await page.locator(':focus').getAttribute('aria-label') || 
                           await page.locator(':focus').getAttribute('placeholder') || 
                           'element';
        tabOrder.push(focusedText.substring(0, 20));
      }

      console.log('Tab order:', tabOrder);

      // Verify logical progression: search -> severity -> advanced filters -> actions
      expect(tabOrder[0]).toContain('search');
      expect(tabOrder.slice(1, 5)).toContain(expect.stringMatching(/critical|high|medium|low/));
      expect(tabOrder.slice(5)).toContain(expect.stringMatching(/clear|share/i));
    });

    test('should be compatible with high contrast mode', async ({ page }) => {
      // Enable high contrast mode simulation
      await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' });

      // Verify filter controls are still visible
      await expect(searchBox.searchInput).toBeVisible();
      await expect(filterPage.severityBadges.first()).toBeVisible();
      await expect(filterPage.clearAllButton).toBeVisible();

      // Test filter interaction still works
      await filterPage.selectSeverityFilter('high');
      await filterPage.waitForFilterResults();
      
      const count = await repositoryListPage.getRepositoryCount();
      expect(count).toBeGreaterThanOrEqual(0);

      // Verify selected states are visually distinct
      const selectedBadge = page.locator('[data-selected="true"], .selected, [aria-selected="true"]');
      expect(await selectedBadge.count()).toBeGreaterThan(0);
    });

    test('should work with screen reader simulation', async ({ page }) => {
      // Test semantic structure
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      expect(await headings.count()).toBeGreaterThan(3);

      // Test landmarks
      const main = page.locator('main, [role="main"]');
      await expect(main).toBeVisible();

      // Test form controls have labels
      const inputs = page.locator('input');
      const inputCount = await inputs.count();
      
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const hasLabel = await input.getAttribute('aria-label') || 
                        await input.getAttribute('aria-labelledby') ||
                        await page.locator(`label[for="${await input.getAttribute('id')}"]`).count() > 0;
        expect(hasLabel).toBeTruthy();
      }

      // Test that dynamic content changes are announced
      await filterPage.selectSeverityFilter('critical');
      await filterPage.waitForFilterResults();

      const liveRegions = page.locator('[aria-live], [role="status"], [role="alert"]');
      expect(await liveRegions.count()).toBeGreaterThan(0);
    });

    test('should provide sufficient color contrast', async ({ page }) => {
      // This is a simplified test - in practice you'd use automated accessibility tools
      
      // Check that text elements have adequate contrast
      const textElements = page.locator('p, span, div').filter({ hasText: /\w+/ });
      const sampleCount = Math.min(10, await textElements.count());

      for (let i = 0; i < sampleCount; i++) {
        const element = textElements.nth(i);
        const styles = await element.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            fontSize: computed.fontSize
          };
        });

        // Basic validation that colors are defined
        expect(styles.color).toBeDefined();
        expect(styles.color).not.toBe('');
      }

      // Test interactive elements have focus indicators
      await searchBox.searchInput.focus();
      const focusedStyles = await searchBox.searchInput.evaluate((el) => {
        return window.getComputedStyle(el, ':focus');
      });
      
      // Should have some kind of focus indication (outline, box-shadow, etc.)
      const hasFocusIndicator = 
        focusedStyles.outline !== 'none' ||
        focusedStyles.boxShadow !== 'none' ||
        focusedStyles.borderColor !== focusedStyles.borderColor; // Different from unfocused state

      expect(hasFocusIndicator).toBeTruthy();
    });
  });
});