import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Advanced Filter functionality
 * Handles all filter control interactions and validation
 */
export class FilterPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly severityBadges: Locator;
  readonly showResultsToggle: Locator;
  readonly languageFilter: Locator;
  readonly topicFilter: Locator;
  readonly activityPeriodSelect: Locator;
  readonly lastScanAgeSelect: Locator;
  readonly complianceScoreSlider: Locator;
  readonly clearAllButton: Locator;
  readonly shareFiltersButton: Locator;
  readonly resultsCount: Locator;
  readonly activeFiltersSection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder(/Search by name, description/);
    this.severityBadges = page.locator('[data-testid="severity-badge"]');
    this.showResultsToggle = page.getByRole('button', { name: /With Findings/ });
    this.languageFilter = page.locator('[data-testid="language-filter"]');
    this.topicFilter = page.locator('[data-testid="topic-filter"]');
    this.activityPeriodSelect = page.getByLabel('Activity Period');
    this.lastScanAgeSelect = page.getByLabel('Last Scan Age');
    this.complianceScoreSlider = page.locator('[data-testid="compliance-score-slider"]');
    this.clearAllButton = page.getByRole('button', { name: /Clear All/ });
    this.shareFiltersButton = page.getByRole('button', { name: /Share Filters/ });
    this.resultsCount = page.locator('[data-testid="results-count"]');
    this.activeFiltersSection = page.locator('[data-testid="active-filters"]');
  }

  /**
   * Enter search query text
   */
  async enterSearchQuery(query: string) {
    await this.searchInput.fill(query);
    // Wait for debounced search
    await this.page.waitForTimeout(350);
  }

  /**
   * Clear the search input
   */
  async clearSearch() {
    await this.searchInput.clear();
    await this.page.waitForTimeout(350);
  }

  /**
   * Select a severity filter
   */
  async selectSeverityFilter(severity: string) {
    await this.page.getByText(severity, { exact: true }).click();
  }

  /**
   * Clear severity filter
   */
  async clearSeverityFilter() {
    // Click the selected severity badge again to deselect
    await this.severityBadges.filter({ hasText: /selected/ }).first().click();
  }

  /**
   * Toggle the "With Findings" filter
   */
  async toggleResultsOnlyFilter() {
    await this.showResultsToggle.click();
  }

  /**
   * Select multiple languages from the language filter
   */
  async selectLanguages(languages: string[]) {
    for (const language of languages) {
      await this.languageFilter.getByText(language, { exact: true }).click();
    }
  }

  /**
   * Select multiple topics from the topic filter
   */
  async selectTopics(topics: string[]) {
    for (const topic of topics) {
      await this.topicFilter.getByText(topic, { exact: true }).click();
    }
  }

  /**
   * Set activity period filter
   */
  async selectActivityPeriod(period: string) {
    await this.activityPeriodSelect.click();
    await this.page.getByRole('option', { name: period }).click();
  }

  /**
   * Set last scan age filter
   */
  async selectLastScanAge(age: string) {
    await this.lastScanAgeSelect.click();
    await this.page.getByRole('option', { name: age }).click();
  }

  /**
   * Set compliance score range using slider
   */
  async setComplianceScoreRange(min: number, max: number) {
    // Get slider bounds
    const sliderBounds = await this.complianceScoreSlider.boundingBox();
    if (!sliderBounds) throw new Error('Compliance score slider not found');

    // Calculate positions for min and max values
    const minPosition = (min / 100) * sliderBounds.width;
    const maxPosition = (max / 100) * sliderBounds.width;

    // Move to min position and drag
    await this.page.mouse.move(
      sliderBounds.x + minPosition, 
      sliderBounds.y + sliderBounds.height / 2
    );
    await this.page.mouse.down();
    await this.page.mouse.move(
      sliderBounds.x + maxPosition, 
      sliderBounds.y + sliderBounds.height / 2
    );
    await this.page.mouse.up();
  }

  /**
   * Clear all active filters
   */
  async clearAllFilters() {
    await this.clearAllButton.click();
  }

  /**
   * Share filters (copy URL to clipboard)
   */
  async shareFilters() {
    await this.shareFiltersButton.click();
  }

  /**
   * Apply boolean search operators
   */
  async searchWithBooleanOperator(operator: 'AND' | 'OR' | 'NOT', terms: string[]) {
    let query: string;
    switch (operator) {
      case 'AND':
        query = terms.join(' AND ');
        break;
      case 'OR':
        query = terms.join(' OR ');
        break;
      case 'NOT':
        query = `${terms[0]} NOT ${terms.slice(1).join(' NOT ')}`;
        break;
    }
    await this.enterSearchQuery(query);
  }

  /**
   * Search using field-specific queries
   */
  async searchWithFieldQuery(field: string, value: string) {
    await this.enterSearchQuery(`${field}:${value}`);
  }

  /**
   * Verify the results count displays correctly
   */
  async verifyRepositoryCount(expectedCount: number) {
    await expect(this.resultsCount).toContainText(`Showing ${expectedCount}`);
  }

  /**
   * Verify that specific active filters are displayed
   */
  async verifyActiveFilter(filterText: string) {
    await expect(this.activeFiltersSection.getByText(filterText)).toBeVisible();
  }

  /**
   * Wait for filter results to update
   */
  async waitForFilterResults() {
    // Wait for loading states to complete
    await this.page.waitForTimeout(500);
    // Could also wait for specific loading indicators
  }

  /**
   * Get current URL for filter state validation
   */
  async getCurrentURL(): Promise<string> {
    return this.page.url();
  }

  /**
   * Verify URL contains specific filter parameters
   */
  async verifyURLContainsFilters(expectedParams: string[]) {
    const currentUrl = await this.getCurrentURL();
    for (const param of expectedParams) {
      expect(currentUrl).toContain(param);
    }
  }
}