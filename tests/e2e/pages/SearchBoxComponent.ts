import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Search Box Component
 * Handles search input interactions and validation
 */
export class SearchBoxComponent {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly searchSuggestions: Locator;
  readonly searchHistory: Locator;
  readonly clearSearchButton: Locator;
  readonly searchHelpText: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder(/Search by name, description/);
    this.searchSuggestions = page.locator('[data-testid="search-suggestions"]');
    this.searchHistory = page.locator('[data-testid="search-history"]');
    this.clearSearchButton = page.locator('[data-testid="clear-search"]');
    this.searchHelpText = page.locator('[data-testid="search-help"]');
  }

  /**
   * Enter text into search input
   */
  async enterText(text: string) {
    await this.searchInput.fill(text);
  }

  /**
   * Clear search input
   */
  async clearSearch() {
    await this.searchInput.clear();
  }

  /**
   * Click clear search button
   */
  async clickClearSearch() {
    await this.clearSearchButton.click();
  }

  /**
   * Press Enter to execute search
   */
  async pressEnter() {
    await this.searchInput.press('Enter');
  }

  /**
   * Type text character by character (for testing debouncing)
   */
  async typeSlowly(text: string, delay: number = 100) {
    await this.searchInput.clear();
    for (const char of text) {
      await this.searchInput.type(char);
      await this.page.waitForTimeout(delay);
    }
  }

  /**
   * Verify search input contains specific text
   */
  async verifySearchText(expectedText: string) {
    await expect(this.searchInput).toHaveValue(expectedText);
  }

  /**
   * Verify search suggestions are shown
   */
  async verifySuggestionsVisible() {
    await expect(this.searchSuggestions).toBeVisible();
  }

  /**
   * Select a search suggestion
   */
  async selectSuggestion(suggestionText: string) {
    await this.searchSuggestions.getByText(suggestionText).click();
  }

  /**
   * Verify help text is shown for complex queries
   */
  async verifyHelpText(expectedText: string) {
    await expect(this.searchHelpText).toContainText(expectedText);
  }

  /**
   * Test boolean operator syntax highlighting
   */
  async verifyBooleanHighlighting(query: string, highlightedParts: string[]) {
    await this.enterText(query);
    
    for (const part of highlightedParts) {
      await expect(this.searchInput.locator('.highlight', { hasText: part })).toBeVisible();
    }
  }

  /**
   * Test field-specific query highlighting
   */
  async verifyFieldQueryHighlighting(query: string) {
    await this.enterText(query);
    
    // Verify field queries are highlighted differently
    const fieldMatches = query.match(/(\w+):(\w+)/g);
    if (fieldMatches) {
      for (const match of fieldMatches) {
        await expect(this.searchInput.locator('.field-query', { hasText: match })).toBeVisible();
      }
    }
  }
}