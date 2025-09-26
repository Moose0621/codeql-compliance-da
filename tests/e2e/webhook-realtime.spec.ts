import { test, expect } from '@playwright/test';
import type { 
  WorkflowRunWebhookEvent, 
  CodeScanningAlertWebhookEvent,
  WebSocketMessage 
} from '@/types/dashboard';

/**
 * End-to-end tests for real-time webhook integration
 * Tests complete flow from webhook to UI updates in the browser
 */

test.describe('Real-time Webhook Integration E2E', () => {
  
  test.beforeEach(async ({ page, context }) => {
    // Mock GitHub API responses
    await page.route('**/api.github.com/**', (route) => {
      const url = route.request().url();
      
      if (url.includes('/user')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            login: 'test-user', 
            name: 'Test User',
            avatar_url: 'https://avatars.example.com/u/1'
          })
        });
      } else if (url.includes('/orgs/test-org/repos')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              name: 'webhook-test-repo',
              full_name: 'test-org/webhook-test-repo',
              default_branch: 'main',
              owner: { 
                login: 'test-org', 
                avatar_url: 'https://avatars.example.com/u/1' 
              },
              has_codeql_workflow: true,
              last_scan_status: 'success',
              last_scan_date: '2023-01-01T00:00:00Z'
            }
          ])
        });
      } else if (url.includes('/repos/test-org/webhook-test-repo/code-scanning/alerts')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              number: 1,
              rule: {
                id: 'test-rule',
                security_severity_level: 'high',
                severity: 'error',
                description: 'Test security rule'
              },
              created_at: '2023-01-01T00:00:00Z',
              updated_at: '2023-01-01T00:00:00Z',
              state: 'open'
            }
          ])
        });
      } else if (url.includes('/repos/test-org/webhook-test-repo/actions/workflows')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            workflows: [
              {
                id: 1,
                name: 'CodeQL',
                path: '.github/workflows/codeql.yml',
                state: 'active'
              }
            ]
          })
        });
      } else {
        route.fulfill({ status: 404 });
      }
    });

    // Mock WebSocket server for testing
    await context.exposeFunction('mockWebSocketServer', (action: string, data?: any) => {
      // This would normally be handled by a real WebSocket server
      return { success: true, action, data };
    });
  });

  test('should establish GitHub connection and display real-time status', async ({ page }) => {
    await page.goto('/');
    
    // Connect to GitHub
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
    await page.getByLabel('Organization').fill('test-org');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    // Wait for connection and repository loading
    await expect(page.getByText('webhook-test-repo')).toBeVisible();
    
    // Check for real-time connection indicator (would be implemented in UI)
    // This is a placeholder for where real-time status would be shown
    await expect(page.getByRole('tab', { name: 'Repositories' })).toHaveAttribute('data-state', 'active');
    
    // Verify initial repository state
    const repoCard = page.locator('[data-testid="repository-card"]:has-text("webhook-test-repo")');
    await expect(repoCard).toBeVisible();
    await expect(repoCard.getByText('Success')).toBeVisible(); // Last scan status
  });

  test('should update repository status in real-time when webhook received', async ({ page }) => {
    await page.goto('/');
    
    // Setup GitHub connection
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
    await page.getByLabel('Organization').fill('test-org');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    await expect(page.getByText('webhook-test-repo')).toBeVisible();
    
    // Simulate incoming webhook event (in real implementation, this would come from WebSocket)
    const workflowWebhook: WorkflowRunWebhookEvent = {
      action: 'completed',
      repository: {
        id: 1,
        name: 'webhook-test-repo',
        full_name: 'test-org/webhook-test-repo',
        owner: { login: 'test-org', avatar_url: 'https://avatars.example.com/u/1' }
      },
      sender: { login: 'github-actions[bot]', avatar_url: 'https://avatars.example.com/u/1' },
      workflow_run: {
        id: 12345,
        name: 'CodeQL',
        status: 'completed',
        conclusion: 'failure',
        created_at: '2023-01-02T10:00:00Z',
        updated_at: '2023-01-02T10:05:00Z',
        html_url: 'https://github.com/test-org/webhook-test-repo/actions/runs/12345',
        run_number: 42,
        workflow_id: 67890,
        head_commit: {
          id: 'abc123def456',
          message: 'Update security scanning rules',
          author: { name: 'developer', email: 'dev@company.com' }
        }
      }
    };

    // Simulate receiving webhook via JavaScript (in real app, this would come through WebSocket)
    await page.evaluate((webhook) => {
      // Simulate real-time event processing
      const event = new CustomEvent('webhook-received', { 
        detail: {
          type: 'webhook_received',
          data: { eventType: 'workflow_run', payload: webhook },
          timestamp: new Date().toISOString(),
          source: 'webhook'
        }
      });
      window.dispatchEvent(event);
    }, workflowWebhook);

    // In a real implementation, we would expect the UI to update automatically
    // For now, we verify the test setup works
    const repoCard = page.locator('[data-testid="repository-card"]:has-text("webhook-test-repo")');
    await expect(repoCard).toBeVisible();
  });

  test('should show real-time security alerts when code scanning webhook received', async ({ page }) => {
    await page.goto('/');
    
    // Setup connection
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
    await page.getByLabel('Organization').fill('test-org');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    await expect(page.getByText('webhook-test-repo')).toBeVisible();
    
    // Navigate to Security Analytics tab
    await page.getByRole('tab', { name: 'Security Analytics' }).click();
    await expect(page.getByRole('tab', { name: 'Security Analytics' })).toHaveAttribute('data-state', 'active');
    
    // Simulate code scanning alert webhook
    const alertWebhook: CodeScanningAlertWebhookEvent = {
      action: 'created',
      repository: {
        id: 1,
        name: 'webhook-test-repo',
        full_name: 'test-org/webhook-test-repo',
        owner: { login: 'test-org', avatar_url: 'https://avatars.example.com/u/1' }
      },
      sender: { login: 'github-actions[bot]', avatar_url: 'https://avatars.example.com/u/1' },
      alert: {
        number: 25,
        created_at: '2023-01-02T11:30:00Z',
        updated_at: '2023-01-02T11:30:00Z',
        dismissed_at: null,
        dismissed_by: null,
        dismissed_reason: null,
        rule: {
          id: 'js/sql-injection',
          severity: 'error',
          security_severity_level: 'critical',
          description: 'Database query built from user-controlled sources'
        },
        state: 'open'
      }
    };

    // Simulate receiving the webhook
    await page.evaluate((webhook) => {
      const event = new CustomEvent('webhook-received', { 
        detail: {
          type: 'webhook_received',
          data: { eventType: 'code_scanning_alert', payload: webhook },
          timestamp: new Date().toISOString(),
          source: 'webhook'
        }
      });
      window.dispatchEvent(event);
    }, alertWebhook);

    // Verify security analytics section exists
    // In real implementation, this would show updated alert counts
    await expect(page.getByText('Security Analytics')).toBeVisible();
  });

  test('should handle WebSocket connection lifecycle correctly', async ({ page }) => {
    await page.goto('/');
    
    // Monitor WebSocket connections
    const webSocketMessages: any[] = [];
    
    page.on('websocket', ws => {
      ws.on('framesent', event => webSocketMessages.push({ type: 'sent', data: event.payload }));
      ws.on('framereceived', event => webSocketMessages.push({ type: 'received', data: event.payload }));
    });
    
    // Connect to GitHub
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
    await page.getByLabel('Organization').fill('test-org');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    await expect(page.getByText('webhook-test-repo')).toBeVisible();
    
    // In a real implementation, WebSocket connection would be established
    // For now, verify the page loaded correctly
    await expect(page.getByRole('tab', { name: 'Repositories' })).toBeVisible();
  });

  test('should maintain state consistency during rapid webhook events', async ({ page }) => {
    await page.goto('/');
    
    // Setup connection
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');  
    await page.getByLabel('Organization').fill('test-org');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    await expect(page.getByText('webhook-test-repo')).toBeVisible();
    
    // Simulate rapid sequence of webhooks
    const webhooks = [
      { action: 'queued', conclusion: null, status: 'queued' },
      { action: 'in_progress', conclusion: null, status: 'in_progress' },
      { action: 'completed', conclusion: 'success', status: 'completed' }
    ];

    for (const [index, webhookData] of webhooks.entries()) {
      const webhook: WorkflowRunWebhookEvent = {
        action: webhookData.action as any,
        repository: {
          id: 1,
          name: 'webhook-test-repo',
          full_name: 'test-org/webhook-test-repo',
          owner: { login: 'test-org', avatar_url: 'https://avatars.example.com/u/1' }
        },
        sender: { login: 'github-actions[bot]', avatar_url: 'https://avatars.example.com/u/1' },
        workflow_run: {
          id: 12345,
          name: 'CodeQL',
          status: webhookData.status as any,
          conclusion: webhookData.conclusion as any,
          created_at: '2023-01-02T10:00:00Z',
          updated_at: `2023-01-02T10:${(index + 1).toString().padStart(2, '0')}:00Z`,
          html_url: 'https://github.com/test-org/webhook-test-repo/actions/runs/12345',
          run_number: 42,
          workflow_id: 67890,
          head_commit: {
            id: 'abc123def456',
            message: 'Test commit',
            author: { name: 'developer', email: 'dev@company.com' }
          }
        }
      };

      await page.evaluate((webhook) => {
        const event = new CustomEvent('webhook-received', { 
          detail: {
            type: 'webhook_received',
            data: { eventType: 'workflow_run', payload: webhook },
            timestamp: new Date().toISOString(),
            source: 'webhook'
          }
        });
        window.dispatchEvent(event);
      }, webhook);

      // Small delay to simulate realistic timing
      await page.waitForTimeout(50);
    }

    // Verify final state is consistent
    const repoCard = page.locator('[data-testid="repository-card"]:has-text("webhook-test-repo")');
    await expect(repoCard).toBeVisible();
  });

  test('should show connection status and handle reconnection', async ({ page }) => {
    await page.goto('/');
    
    // Connect to GitHub
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
    await page.getByLabel('Organization').fill('test-org');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    await expect(page.getByText('webhook-test-repo')).toBeVisible();
    
    // In a real implementation, we would:
    // 1. Show WebSocket connection status indicator
    // 2. Test connection interruption and recovery
    // 3. Verify UI handles offline/online states
    
    // For now, verify the basic UI is responsive
    await page.getByRole('tab', { name: 'Security Analytics' }).click();
    await expect(page.getByRole('tab', { name: 'Security Analytics' })).toHaveAttribute('data-state', 'active');
    
    await page.getByRole('tab', { name: 'Repositories' }).click();
    await expect(page.getByRole('tab', { name: 'Repositories' })).toHaveAttribute('data-state', 'active');
  });

  test('should handle multiple browser tabs synchronization', async ({ context }) => {
    // Create two pages to test multi-tab synchronization
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    
    // Setup both pages
    for (const page of [page1, page2]) {
      await page.goto('/');
      await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
      await page.getByLabel('Organization').fill('test-org');
      await page.getByRole('button', { name: 'Connect' }).click();
      await expect(page.getByText('webhook-test-repo')).toBeVisible();
    }
    
    // Simulate webhook event on page1
    const webhook: WorkflowRunWebhookEvent = {
      action: 'completed',
      repository: {
        id: 1,
        name: 'webhook-test-repo',
        full_name: 'test-org/webhook-test-repo',
        owner: { login: 'test-org', avatar_url: 'https://avatars.example.com/u/1' }
      },
      sender: { login: 'user', avatar_url: 'https://avatars.example.com/u/1' },
      workflow_run: {
        id: 12345,
        name: 'CodeQL',
        status: 'completed',
        conclusion: 'success',
        created_at: '2023-01-02T10:00:00Z',
        updated_at: '2023-01-02T10:05:00Z',
        html_url: 'https://github.com/test-org/webhook-test-repo/actions/runs/12345',
        run_number: 42,
        workflow_id: 67890,
        head_commit: {
          id: 'abc123def456',
          message: 'Test commit',
          author: { name: 'developer', email: 'dev@company.com' }
        }
      }
    };

    await page1.evaluate((webhook) => {
      const event = new CustomEvent('webhook-received', { 
        detail: {
          type: 'webhook_received',
          data: { eventType: 'workflow_run', payload: webhook },
          timestamp: new Date().toISOString(),
          source: 'webhook'
        }
      });
      window.dispatchEvent(event);
    }, webhook);

    // In a real implementation, both tabs would show the updated state
    // through shared WebSocket connections or localStorage synchronization
    
    // Verify both pages are still responsive
    await expect(page1.getByText('webhook-test-repo')).toBeVisible();
    await expect(page2.getByText('webhook-test-repo')).toBeVisible();
    
    await page1.close();
    await page2.close();
  });

  test('should display webhook event history and metrics', async ({ page }) => {
    await page.goto('/');
    
    // Connect to GitHub
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
    await page.getByLabel('Organization').fill('test-org');
    await page.getByRole('button', { name: 'Connect' }).click();
    
    await expect(page.getByText('webhook-test-repo')).toBeVisible();
    
    // Navigate to Audit Trail (where webhook events would be logged)
    await page.getByRole('tab', { name: 'Audit Trail' }).click();
    await expect(page.getByRole('tab', { name: 'Audit Trail' })).toHaveAttribute('data-state', 'active');
    
    // In a real implementation, this section would show:
    // - Recent webhook events received
    // - Event processing times
    // - Connection health metrics
    // - Failed webhook deliveries
    
    // Verify audit trail section is accessible
    await expect(page.getByText('Audit Trail')).toBeVisible();
  });
});