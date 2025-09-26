import { test, expect } from '@playwright/test';
import { WebhookIntegrationPage } from './page-objects/webhook-integration';
import { MockWebhookServer } from './mocks/webhook-server';
import { MockWebSocketServer } from './mocks/websocket-server';

test.describe('Real-time UI Synchronization Tests', () => {
  let webhookServer: MockWebhookServer;
  let websocketServer: MockWebSocketServer;
  let webhookPage: WebhookIntegrationPage;

  test.beforeAll(async () => {
    webhookServer = new MockWebhookServer();
    websocketServer = new MockWebSocketServer();
    
    await webhookServer.start();
    await websocketServer.start();
  });

  test.afterAll(async () => {
    await webhookServer.stop();
    await websocketServer.stop();
  });

  test.beforeEach(async ({ page }) => {
    webhookPage = new WebhookIntegrationPage(page, webhookServer, websocketServer);
    
    // Set up GitHub API mocking
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
            },
            {
              id: 2,
              name: 'test-repo-2',
              full_name: 'test-org/test-repo-2',
              default_branch: 'main',
              owner: { login: 'test-org', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' }
            }
          ])
        });
      } else {
        route.fulfill({ status: 404 });
      }
    });

    await page.goto('/');
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
    await page.getByLabel('Organization').fill('test-org');
    await page.getByRole('button', { name: 'Connect' }).click();
  });

  test.describe('Dashboard Updates Without Page Refresh', () => {
    test('should update repository cards in real-time', async ({ page }) => {
      await webhookPage.waitForWebSocketConnection();
      
      // Verify initial repository state
      await expect(page.locator('[data-testid="repo-test-repo-1"]')).toBeVisible();
      const initialLastScan = await page.locator('[data-testid="repo-test-repo-1-last-scan"]').textContent();
      
      // Simulate workflow completion webhook
      const workflowPayload = {
        action: 'completed',
        workflow_run: {
          id: 12345,
          name: 'CodeQL',
          status: 'completed',
          conclusion: 'success',
          created_at: new Date().toISOString()
        },
        repository: {
          id: 1,
          name: 'test-repo-1',
          full_name: 'test-org/test-repo-1'
        }
      };

      await webhookPage.simulateGitHubWebhook('workflow_run', workflowPayload);
      
      // Verify repository card updates without page refresh
      await expect(page.locator('[data-testid="repo-test-repo-1-scan-status"]')).toContainText('success', { timeout: 2000 });
      await expect(page.locator('[data-testid="repo-test-repo-1-last-scan"]')).not.toContainText(initialLastScan || '');
      
      // Verify page wasn't refreshed by checking URL and DOM state
      expect(page.url()).toContain('/');
      await expect(page.locator('[data-testid="repo-test-repo-1"]')).toBeVisible();
      
      // Verify no loading states are shown (real-time update)
      await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
    });

    test('should show real-time status indicators', async ({ page }) => {
      await webhookPage.waitForWebSocketConnection();
      
      // Trigger scan request to test optimistic updates
      await page.getByTestId('repo-test-repo-1-scan-button').click();
      
      // Verify optimistic UI update (immediate status change)
      await webhookPage.verifyOptimisticUpdate('[data-testid="repo-test-repo-1-status"]', 'scanning');
      
      // Simulate workflow started webhook
      const workflowStarted = {
        action: 'requested',
        workflow_run: {
          id: 54321,
          name: 'CodeQL',
          status: 'requested',
          conclusion: null,
          created_at: new Date().toISOString()
        },
        repository: {
          id: 1,
          name: 'test-repo-1',
          full_name: 'test-org/test-repo-1'
        }
      };

      await webhookPage.simulateGitHubWebhook('workflow_run', workflowStarted);
      
      // Verify status indicator updates to running
      await expect(page.locator('[data-testid="repo-test-repo-1-status"]')).toContainText('running', { timeout: 2000 });
      await expect(page.locator('[data-testid="repo-test-repo-1-progress"]')).toBeVisible();
      
      // Test status transitions
      const workflowInProgress = {
        action: 'in_progress',
        workflow_run: {
          id: 54321,
          name: 'CodeQL',
          status: 'in_progress',
          conclusion: null,
          created_at: new Date().toISOString()
        },
        repository: {
          id: 1,
          name: 'test-repo-1',
          full_name: 'test-org/test-repo-1'
        }
      };

      await webhookPage.simulateGitHubWebhook('workflow_run', workflowInProgress);
      
      // Verify progress indicator shows
      await expect(page.locator('[data-testid="repo-test-repo-1-progress-bar"]')).toBeVisible();
    });

    test('should update notification badges immediately', async ({ page }) => {
      await webhookPage.waitForWebSocketConnection();
      
      // Check initial notification state
      const initialNotifications = await page.locator('[data-testid="notification-badge"]').textContent();
      const initialCount = parseInt(initialNotifications || '0');
      
      // Simulate security alert webhook
      const securityAlertPayload = {
        action: 'created',
        alert: {
          number: 123,
          state: 'open',
          rule: {
            id: 'js/sql-injection',
            severity: 'error',
            security_severity_level: 'high'
          }
        },
        repository: {
          id: 1,
          name: 'test-repo-1',
          full_name: 'test-org/test-repo-1'
        }
      };

      await webhookPage.simulateGitHubWebhook('code_scanning_alert', securityAlertPayload);
      
      // Verify notification badge updates immediately
      await webhookPage.verifyNotificationBadgeUpdate(initialCount + 1);
      
      // Verify notification appears in notification panel
      await page.getByTestId('notifications-toggle').click();
      await expect(page.locator('[data-testid="notification-item-123"]')).toBeVisible();
      await expect(page.locator('[data-testid="notification-item-123"]')).toContainText('SQL injection');
    });

    test('should show appropriate loading states during real-time processing', async ({ page }) => {
      await webhookPage.waitForWebSocketConnection();
      
      // Trigger bulk scan operation
      await page.getByTestId('bulk-scan-button').click();
      await page.getByTestId('confirm-bulk-scan').click();
      
      // Verify loading states appear
      await webhookPage.verifyLoadingStates();
      await expect(page.locator('[data-testid="bulk-scan-progress"]')).toBeVisible();
      
      // Simulate multiple workflow events
      for (let i = 0; i < 3; i++) {
        const workflowPayload = {
          action: 'completed',
          workflow_run: {
            id: 12345 + i,
            name: 'CodeQL',
            status: 'completed',
            conclusion: 'success'
          },
          repository: {
            id: i === 0 ? 1 : 2,
            name: i === 0 ? 'test-repo-1' : 'test-repo-2',
            full_name: i === 0 ? 'test-org/test-repo-1' : 'test-org/test-repo-2'
          }
        };

        await webhookPage.simulateGitHubWebhook('workflow_run', workflowPayload);
        await page.waitForTimeout(500);
      }
      
      // Verify loading states are cleared when complete
      await expect(page.locator('[data-testid="bulk-scan-progress"]')).not.toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-testid="bulk-scan-complete"]')).toBeVisible();
    });

    test('should handle optimistic updates with rollback capability', async ({ page }) => {
      await webhookPage.waitForWebSocketConnection();
      
      const originalStatus = await page.locator('[data-testid="repo-test-repo-1-status"]').textContent();
      
      // Trigger scan request
      await page.getByTestId('repo-test-repo-1-scan-button').click();
      
      // Verify optimistic update
      await webhookPage.verifyOptimisticUpdate('[data-testid="repo-test-repo-1-status"]', 'scanning');
      
      // Simulate failure and verify rollback
      await webhookPage.verifyOptimisticRollback('[data-testid="repo-test-repo-1-status"]', originalStatus || '');
      
      // Verify error message is shown
      await expect(page.locator('[data-testid="scan-error-message"]')).toBeVisible();
    });
  });

  test.describe('Multi-Tab Synchronization', () => {
    test('should synchronize real-time updates across browser tabs', async ({ page, browser }) => {
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      const webhookPage2 = new WebhookIntegrationPage(page2, webhookServer, websocketServer);
      
      // Set up second tab
      await page2.route('**/api.github.com/**', (route) => {
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
        } else {
          route.fulfill({ status: 404 });
        }
      });

      await page2.goto('/');
      await page2.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page2.getByLabel('Organization').fill('test-org');
      await page2.getByRole('button', { name: 'Connect' }).click();
      
      await webhookPage.waitForWebSocketConnection();
      await webhookPage2.waitForWebSocketConnection();
      
      // Trigger action in first tab
      await page.getByTestId('repo-test-repo-1-scan-button').click();
      
      // Verify both tabs show the update
      await expect(page.locator('[data-testid="repo-test-repo-1-status"]')).toContainText('scanning', { timeout: 2000 });
      await expect(page2.locator('[data-testid="repo-test-repo-1-status"]')).toContainText('scanning', { timeout: 2000 });
      
      // Send webhook event
      const completionPayload = {
        action: 'completed',
        workflow_run: {
          id: 99999,
          name: 'CodeQL',
          status: 'completed',
          conclusion: 'success',
          created_at: new Date().toISOString()
        },
        repository: {
          id: 1,
          name: 'test-repo-1',
          full_name: 'test-org/test-repo-1'
        }
      };

      await webhookPage.simulateGitHubWebhook('workflow_run', completionPayload);
      
      // Verify both tabs reflect the completion
      await expect(page.locator('[data-testid="repo-test-repo-1-status"]')).toContainText('success', { timeout: 2000 });
      await expect(page2.locator('[data-testid="repo-test-repo-1-status"]')).toContainText('success', { timeout: 2000 });
      
      await context2.close();
    });

    test('should maintain state consistency across tabs during rapid updates', async ({ page, browser }) => {
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      const webhookPage2 = new WebhookIntegrationPage(page2, webhookServer, websocketServer);
      
      // Set up both tabs (abbreviated setup)
      await page2.route('**/api.github.com/**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ login: 'test-user', name: 'Test User' })
        });
      });

      await page2.goto('/');
      await page2.addInitScript(() => {
        localStorage.setItem('github-config', JSON.stringify({
          token: 'ghp_test_token_123',
          organization: 'test-org',
          isConnected: true
        }));
      });
      
      await webhookPage.waitForWebSocketConnection();
      await webhookPage2.waitForWebSocketConnection();
      
      // Send rapid sequence of updates
      const events = [
        { type: 'push', payload: { commits: [{ id: 'commit1', message: 'First update' }], repository: { id: 1, name: 'test-repo-1' } }, expectedOrder: 1 },
        { type: 'push', payload: { commits: [{ id: 'commit2', message: 'Second update' }], repository: { id: 1, name: 'test-repo-1' } }, expectedOrder: 2 },
        { type: 'push', payload: { commits: [{ id: 'commit3', message: 'Third update' }], repository: { id: 1, name: 'test-repo-1' } }, expectedOrder: 3 }
      ];

      await webhookPage.verifyEventOrdering(events);
      
      // Verify both tabs have consistent final state
      const finalState1 = await page.locator('[data-testid="repo-test-repo-1-commit"]').textContent();
      const finalState2 = await page2.locator('[data-testid="repo-test-repo-1-commit"]').textContent();
      
      expect(finalState1).toBe(finalState2);
      expect(finalState1).toContain('commit3');
      
      await context2.close();
    });

    test('should handle tab focus changes and background sync', async ({ page, browser }) => {
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      
      // Set up background tab (page2)
      await page2.goto('/');
      await page2.addInitScript(() => {
        localStorage.setItem('github-config', JSON.stringify({
          token: 'ghp_test_token_123',
          organization: 'test-org',
          isConnected: true
        }));
      });
      
      const webhookPage2 = new WebhookIntegrationPage(page2, webhookServer, websocketServer);
      await webhookPage.waitForWebSocketConnection();
      await webhookPage2.waitForWebSocketConnection();
      
      // Focus on first tab and send updates
      await page.bringToFront();
      
      const backgroundUpdatePayload = {
        action: 'opened',
        pull_request: {
          id: 789,
          number: 456,
          title: 'Background PR',
          state: 'open'
        },
        repository: {
          id: 1,
          name: 'test-repo-1',
          full_name: 'test-org/test-repo-1'
        }
      };

      await webhookPage.simulateGitHubWebhook('pull_request', backgroundUpdatePayload);
      
      // Switch to background tab and verify it received updates
      await page2.bringToFront();
      await expect(page2.locator('[data-testid="pr-notification"]')).toBeVisible({ timeout: 3000 });
      
      await context2.close();
    });
  });

  test.describe('Event Sequence and Timing', () => {
    test('should maintain correct event processing order', async ({ page }) => {
      await webhookPage.waitForWebSocketConnection();
      
      const sequentialEvents = [
        { type: 'push', payload: { commits: [{ id: 'seq1', message: 'Event 1' }], repository: { id: 1, name: 'test-repo-1' } }, expectedOrder: 1 },
        { type: 'push', payload: { commits: [{ id: 'seq2', message: 'Event 2' }], repository: { id: 1, name: 'test-repo-1' } }, expectedOrder: 2 },
        { type: 'workflow_run', payload: { action: 'completed', workflow_run: { id: 1, status: 'completed', conclusion: 'success' }, repository: { id: 1, name: 'test-repo-1' } }, expectedOrder: 3 }
      ];

      await webhookPage.verifyEventOrdering(sequentialEvents);
      
      // Verify final UI state reflects correct ordering
      const eventHistory = await page.locator('[data-testid="event-history"]').textContent();
      expect(eventHistory).toContain('seq1');
      expect(eventHistory).toContain('seq2');
      expect(eventHistory).toContain('completed');
    });

    test('should validate real-time update timing requirements', async ({ page }) => {
      await webhookPage.waitForWebSocketConnection();
      
      const startTime = Date.now();
      
      // Send webhook event
      const timingPayload = {
        action: 'completed',
        workflow_run: {
          id: 98765,
          name: 'CodeQL',
          status: 'completed',
          conclusion: 'success',
          created_at: new Date().toISOString()
        },
        repository: {
          id: 1,
          name: 'test-repo-1',
          full_name: 'test-org/test-repo-1'
        }
      };

      await webhookPage.simulateGitHubWebhook('workflow_run', timingPayload);
      
      // Wait for UI update
      await expect(page.locator('[data-testid="repo-test-repo-1-scan-status"]')).toContainText('success', { timeout: 3000 });
      
      const endTime = Date.now();
      const updateLatency = endTime - startTime;
      
      // Verify update happened within acceptable time (< 2 seconds for real-time)
      expect(updateLatency).toBeLessThan(2000);
      console.log(`Real-time update latency: ${updateLatency}ms`);
    });

    test('should detect and handle race conditions', async ({ page }) => {
      await webhookPage.waitForWebSocketConnection();
      
      // Test race conditions in webhook processing
      await webhookPage.testRaceConditions();
      
      // Verify system handles race conditions gracefully
      const finalStatus = await page.locator('[data-testid="repo-test-repo-1-status"]').textContent();
      expect(['success', 'failure']).toContain(finalStatus);
      
      // Verify no duplicate events were processed
      await webhookPage.verifyDuplicatePrevention();
    });

    test('should handle concurrent user interactions during real-time updates', async ({ page, browser }) => {
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      
      // Set up concurrent user scenario
      await page2.goto('/');
      await page2.addInitScript(() => {
        localStorage.setItem('github-config', JSON.stringify({
          token: 'ghp_test_token_123',
          organization: 'test-org',
          isConnected: true
        }));
      });
      
      const webhookPage2 = new WebhookIntegrationPage(page2, webhookServer, websocketServer);
      
      await webhookPage.waitForWebSocketConnection();
      await webhookPage2.waitForWebSocketConnection();
      
      // Simulate concurrent actions
      const action1 = page.getByTestId('repo-test-repo-1-scan-button').click();
      const action2 = page2.getByTestId('repo-test-repo-1-scan-button').click();
      
      // Wait for both actions
      await Promise.all([action1, action2]);
      
      // Verify system handles concurrent actions gracefully
      // Should show appropriate conflict resolution or queue management
      await expect(page.locator('[data-testid="scan-queue-indicator"]')).toBeVisible();
      
      await context2.close();
    });
  });
});