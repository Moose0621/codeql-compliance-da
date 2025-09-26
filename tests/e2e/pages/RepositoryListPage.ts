import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Repository List functionality
 * Handles repository result verification and interactions
 */
export class RepositoryListPage {
  readonly page: Page;
  readonly repositoryCards: Locator;
  readonly repositoryTitles: Locator;
  readonly repositoryCount: Locator;
  readonly loadingIndicator: Locator;
  readonly emptyStateMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.repositoryCards = page.locator('[data-testid="repository-card"]');
    this.repositoryTitles = page.locator('[data-testid="repository-title"]');
    this.repositoryCount = page.locator('[data-testid="repository-count"]');
    this.loadingIndicator = page.locator('[data-testid="loading-spinner"]');
    this.emptyStateMessage = page.locator('[data-testid="empty-state"]');
  }

  /**
   * Wait for repositories to load
   */
  async waitForRepositoriesToLoad() {
    await this.loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Get the count of visible repositories
   */
  async getRepositoryCount(): Promise<number> {
    return await this.repositoryCards.count();
  }

  /**
   * Verify repository count matches expected value
   */
  async verifyRepositoryCount(expectedCount: number) {
    await expect(this.repositoryCards).toHaveCount(expectedCount);
  }

  /**
   * Verify specific repository appears in results
   */
  async verifyRepositoryExists(repositoryName: string) {
    await expect(this.repositoryTitles.filter({ hasText: repositoryName })).toBeVisible();
  }

  /**
   * Verify specific repository does not appear in results
   */
  async verifyRepositoryNotExists(repositoryName: string) {
    await expect(this.repositoryTitles.filter({ hasText: repositoryName })).not.toBeVisible();
  }

  /**
   * Get all repository names from the current results
   */
  async getRepositoryNames(): Promise<string[]> {
    return await this.repositoryTitles.allTextContents();
  }

  /**
   * Verify repository has specific security findings
   */
  async verifyRepositoryHasFindings(repositoryName: string, findingType: string) {
    const repoCard = this.repositoryCards.filter({ 
      has: this.page.locator('[data-testid="repository-title"]', { hasText: repositoryName }) 
    });
    await expect(repoCard.locator(`[data-testid="security-${findingType}"]`)).toBeVisible();
  }

  /**
   * Verify repository has specific language
   */
  async verifyRepositoryHasLanguage(repositoryName: string, language: string) {
    const repoCard = this.repositoryCards.filter({ 
      has: this.page.locator('[data-testid="repository-title"]', { hasText: repositoryName }) 
    });
    await expect(repoCard.locator(`[data-testid="language-${language}"]`)).toBeVisible();
  }

  /**
   * Verify repository has specific topic
   */
  async verifyRepositoryHasTopic(repositoryName: string, topic: string) {
    const repoCard = this.repositoryCards.filter({ 
      has: this.page.locator('[data-testid="repository-title"]', { hasText: repositoryName }) 
    });
    await expect(repoCard.locator(`[data-testid="topic-${topic}"]`)).toBeVisible();
  }

  /**
   * Click on a specific repository card
   */
  async clickRepository(repositoryName: string) {
    const repoCard = this.repositoryCards.filter({ 
      has: this.page.locator('[data-testid="repository-title"]', { hasText: repositoryName }) 
    });
    await repoCard.click();
  }

  /**
   * Verify empty state is shown
   */
  async verifyEmptyState() {
    await expect(this.emptyStateMessage).toBeVisible();
    await expect(this.repositoryCards).toHaveCount(0);
  }

  /**
   * Verify repositories are sorted correctly
   */
  async verifySorting(order: 'asc' | 'desc') {
    const names = await this.getRepositoryNames();
    const sortedNames = [...names].sort((a, b) => 
      order === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
    );
    expect(names).toEqual(sortedNames);
  }

  /**
   * Verify performance metrics (repository load time)
   */
  async measureRepositoryLoadTime(): Promise<number> {
    const startTime = Date.now();
    await this.waitForRepositoriesToLoad();
    const endTime = Date.now();
    return endTime - startTime;
  }

  /**
   * Scroll to load more repositories (for virtual scrolling)
   */
  async scrollToBottom() {
    await this.page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await this.page.waitForTimeout(500);
  }
}