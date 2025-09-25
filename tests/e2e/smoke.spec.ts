import { test, expect } from '@playwright/test';

test.describe('CodeQL Compliance Dashboard - Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock GitHub API responses to avoid rate limiting and external dependencies
    await page.route('**/api.github.com/**', (route) => {
      const url = route.request().url();
      
      if (url.includes('/user')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ login: 'test-user', name: 'Test User' })
        });
      } else if (url.includes('/orgs/test-org/repos')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              name: 'test-repo-1',
              full_name: 'test-org/test-repo-1',
              default_branch: 'main',
              owner: { login: 'test-org', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' }
            }
          ])
        });
      } else if (url.includes('/repos/test-org/test-repo-1/actions/workflows')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            workflows: [
              { id: 1, name: 'CodeQL Analysis', path: '.github/workflows/codeql.yml' }
            ]
          })
        });
      } else if (url.includes('/repos/test-org/test-repo-1/actions/runs')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            workflow_runs: [
              {
                id: 1,
                status: 'completed',
                conclusion: 'success',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:05:00Z',
                html_url: 'https://github.com/test-org/test-repo-1/actions/runs/1'
              }
            ]
          })
        });
      } else if (url.includes('/repos/test-org/test-repo-1/code-scanning/alerts')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              rule: {
                security_severity_level: 'high',
                severity: 'error'
              }
            }
          ])
        });
      } else {
        route.fulfill({ status: 404 });
      }
    });
  });

  test('should load the dashboard homepage', async ({ page }) => {
    await page.goto('/');
    
    // Check for main header
    await expect(page.locator('h1')).toContainText('CodeQL Security Dashboard');
    
    // Check for navigation tabs
    await expect(page.getByRole('tab', { name: 'Setup' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Repositories' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Security Analytics' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Audit Trail' })).toBeVisible();
  });

  test('should allow GitHub connection setup', async ({ page }) => {
    await page.goto('/');
    
    // Should start on Setup tab
    await expect(page.getByRole('tab', { name: 'Setup' })).toHaveAttribute('data-state', 'active');
    
    // Check for connection form elements
    await expect(page.getByLabel('GitHub Token')).toBeVisible();
    await expect(page.getByLabel('Organization')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();
  });

  test('should connect to GitHub and load repositories', async ({ page }) => {
    await page.goto('/');
    
    // Fill in connection details
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
    await page.getByLabel('Organization').fill('test-org');
    
    // Click connect button
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Wait for connection success
    await expect(page.getByText('Connected to test-org')).toBeVisible();
    
    // Should automatically navigate to repositories tab
    await expect(page.getByRole('tab', { name: 'Repositories' })).toHaveAttribute('data-state', 'active');
    
    // Should display repository cards
    await expect(page.getByText('test-repo-1')).toBeVisible();
  });

  test('should display repository information correctly', async ({ page }) => {
    await page.goto('/');
    
    // Set up connection first
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
    await page.getByLabel('Organization').fill('test-org');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Wait for repositories to load
    await expect(page.getByText('test-repo-1')).toBeVisible();
    
    // Check repository card elements
    const repoCard = page.locator('[data-testid="repository-card"]').first();
    await expect(repoCard).toBeVisible();
    
    // Should have scan status
    await expect(repoCard.getByRole('button', { name: 'Request Scan' })).toBeVisible();
    await expect(repoCard.getByRole('button', { name: 'View Details' })).toBeVisible();
  });

  test('should show statistics correctly', async ({ page }) => {
    await page.goto('/');
    
    // Connect to GitHub
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
    await page.getByLabel('Organization').fill('test-org');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Wait for data to load
    await expect(page.getByText('test-repo-1')).toBeVisible();
    
    // Check stats cards
    await expect(page.getByText('Total Repositories')).toBeVisible();
    await expect(page.getByText('Active Scans')).toBeVisible();
    await expect(page.getByText('Total Findings')).toBeVisible();
    await expect(page.getByText('Critical Issues')).toBeVisible();
    
    // Should show "1" for total repositories
    await expect(page.locator('text=Total Repositories').locator('..').getByText('1')).toBeVisible();
  });

  test('should navigate between tabs correctly', async ({ page }) => {
    await page.goto('/');
    
    // Connect first
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
    await page.getByLabel('Organization').fill('test-org');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Navigate to Security Analytics
    await page.getByRole('tab', { name: 'Security Analytics' }).click();
    await expect(page.getByRole('tab', { name: 'Security Analytics' })).toHaveAttribute('data-state', 'active');
    
    // Navigate to Audit Trail
    await page.getByRole('tab', { name: 'Audit Trail' }).click();
    await expect(page.getByRole('tab', { name: 'Audit Trail' })).toHaveAttribute('data-state', 'active');
    
    // Navigate to Export History
    await page.getByRole('tab', { name: 'Export History' }).click();
    await expect(page.getByRole('tab', { name: 'Export History' })).toHaveAttribute('data-state', 'active');
    
    // Back to Repositories
    await page.getByRole('tab', { name: 'Repositories' }).click();
    await expect(page.getByRole('tab', { name: 'Repositories' })).toHaveAttribute('data-state', 'active');
  });

  test('should handle export functionality', async ({ page }) => {
    await page.goto('/');
    
    // Connect first
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
    await page.getByLabel('Organization').fill('test-org');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Wait for repositories to load
    await expect(page.getByText('test-repo-1')).toBeVisible();
    
    // Look for export button (should be visible in header)
    await expect(page.getByRole('button', { name: 'Export Report' })).toBeVisible();
    
    // Click export button to open dialog
    await page.getByRole('button', { name: 'Export Report' }).click();
    
    // Should show export dialog
    await expect(page.getByText('Export Compliance Report')).toBeVisible();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Should still show main elements
    await expect(page.locator('h1')).toContainText('CodeQL Security Dashboard');
    await expect(page.getByRole('tab', { name: 'Setup' })).toBeVisible();
    
    // Mobile-specific checks
    await expect(page.locator('nav')).toBeVisible();
  });
});