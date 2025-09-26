// Enhanced Notification System E2E Tests
import { test, expect } from '@playwright/test';
import { NotificationTestSuite } from './mocks/notification-test-suite';
import { NotificationPreferencesPage } from './pages/notification-preferences-page';
import { NotificationCenterPage } from './pages/notification-center-page';

test.describe('Enhanced Notification System E2E Tests', () => {
  let notificationSuite: NotificationTestSuite;
  let preferencesPage: NotificationPreferencesPage;
  let notificationCenter: NotificationCenterPage;

  test.beforeEach(async ({ page }) => {
    // Initialize test suite and page objects
    notificationSuite = new NotificationTestSuite(page);
    preferencesPage = new NotificationPreferencesPage(page);
    notificationCenter = new NotificationCenterPage(page);

    // Mock GitHub API responses for consistent testing
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
      } else {
        route.fulfill({ status: 404 });
      }
    });

    // Mock notification API routes
    await page.route('**/api/notifications/**', (route) => {
      const method = route.request().method();
      const url = route.request().url();
      
      if (method === 'GET' && url.includes('/preferences')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user_id: 'test-user',
            channels: [
              { id: 'email-1', name: 'email', enabled: true, config: { email: { addresses: ['test@example.com'], format: 'both' } } },
              { id: 'slack-1', name: 'slack', enabled: true, config: { slack: { webhook_url: 'https://hooks.slack.com/test', channel: '#security' } } },
              { id: 'teams-1', name: 'teams', enabled: true, config: { teams: { webhook_url: 'https://outlook.office.com/webhook/test', channel: 'Security Team' } } }
            ],
            frequency: 'immediate',
            content_filters: {
              notification_types: ['security_alert', 'workflow_failure', 'compliance_violation'],
              severity_levels: ['critical', 'high', 'medium', 'low']
            },
            quiet_hours: { enabled: false, start_time: '22:00', end_time: '08:00', timezone: 'UTC' },
            emergency_override: true
          })
        });
      } else if (method === 'POST' && url.includes('/preferences')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'saved', timestamp: new Date().toISOString() })
        });
      } else if (method === 'POST' && url.includes('/trigger')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            event_id: 'test-event-' + Date.now(),
            status: 'processed',
            channels_triggered: ['email', 'slack', 'teams', 'in-app'],
            timestamp: new Date().toISOString()
          })
        });
      } else {
        route.fulfill({ status: 404 });
      }
    });

    // Navigate to dashboard and setup GitHub connection
    await page.goto('/');
    await page.getByLabel('GitHub Token').fill('ghp_test_token_123');
    await page.getByLabel('Organization').fill('test-org');
    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(page.getByText('Connected to test-org')).toBeVisible();
  });

  test.afterEach(async () => {
    // Clean up mock services
    notificationSuite.clearAllDeliveries();
  });

  // ===== FUNCTIONAL TESTS (Critical Priority) =====

  test.describe('Notification Generation and Triggering', () => {
    test('should trigger security alert notifications with correct content', async ({ page }) => {
      // Simulate a security alert
      const event = await notificationSuite.simulateSecurityAlert('critical', 'test-org/vulnerable-repo');
      
      // Verify multi-channel delivery
      await expect.poll(async () => {
        return await notificationSuite.verifyMultiChannelDelivery(['email', 'slack', 'teams']);
      }, { timeout: 10000 }).toBeTruthy();

      // Validate content across channels
      await notificationSuite.validateNotificationContent('email', {
        subject: 'CRITICAL',
        contains: ['Security Vulnerability Detected', 'vulnerable-repo', 'CWE-79'],
        severity: 'critical'
      });

      await notificationSuite.validateNotificationContent('slack', {
        contains: ['Security Vulnerability Detected', 'vulnerable-repo', 'UserInput.tsx'],
        severity: 'critical'
      });

      await notificationSuite.validateNotificationContent('teams', {
        contains: ['Security Vulnerability Detected', 'vulnerable-repo'],
        severity: 'critical'
      });
    });

    test('should trigger compliance violation alerts with policy details', async ({ page }) => {
      const event = await notificationSuite.simulateComplianceViolation('test-org/non-compliant-repo');
      
      // Verify delivery
      await expect.poll(async () => {
        return await notificationSuite.verifyMultiChannelDelivery(['email', 'slack', 'teams']);
      }, { timeout: 10000 }).toBeTruthy();

      // Validate compliance-specific content
      await notificationSuite.validateNotificationContent('email', {
        contains: ['FedRAMP Compliance Violation', 'FedRAMP Scanning Policy', 'Enable CodeQL workflow']
      });
    });

    test('should trigger workflow failure notifications with context', async ({ page }) => {
      const event = await notificationSuite.simulateWorkflowFailure('test-org/failing-repo');
      
      // Verify delivery
      await expect.poll(async () => {
        return await notificationSuite.verifyMultiChannelDelivery(['email', 'slack', 'teams']);
      }, { timeout: 10000 }).toBeTruthy();

      // Validate workflow-specific content
      await notificationSuite.validateNotificationContent('slack', {
        contains: ['CodeQL Workflow Failed', 'compilation errors detected', 'actions/runs/12345678']
      });
    });

    test('should trigger repository status change notifications', async ({ page }) => {
      const event = await notificationSuite.simulateRepositoryStatusChange('test-org/archived-repo');
      
      // Verify delivery (info level should still be delivered with default preferences)
      await expect.poll(async () => {
        return await notificationSuite.verifyMultiChannelDelivery(['email', 'slack', 'teams']);
      }, { timeout: 10000 }).toBeTruthy();
    });
  });

  test.describe('Multi-Channel Delivery Validation', () => {
    test('should deliver notifications to all enabled channels', async ({ page }) => {
      // Clear any existing deliveries
      notificationSuite.clearAllDeliveries();
      
      // Trigger a test event
      await notificationSuite.simulateSecurityAlert('high');
      
      // Verify all channels received notifications
      const stats = notificationSuite.getDeliveryStats();
      expect(stats.email.successful).toBeGreaterThan(0);
      expect(stats.slack.successful).toBeGreaterThan(0);
      expect(stats.teams.successful).toBeGreaterThan(0);
    });

    test('should handle email delivery with HTML and text formats', async ({ page }) => {
      await notificationSuite.simulateSecurityAlert('medium');
      
      const emailDeliveries = notificationSuite.getEmailService().getSuccessfulDeliveries();
      expect(emailDeliveries).toHaveLength(1);
      
      const delivery = emailDeliveries[0];
      expect(delivery.html_body).toContain('<html>');
      expect(delivery.html_body).toContain('Security Vulnerability Detected');
      expect(delivery.text_body).toContain('Security Vulnerability Detected');
      expect(delivery.text_body).not.toContain('<html>');
    });

    test('should format Slack notifications with rich attachments', async ({ page }) => {
      await notificationSuite.simulateSecurityAlert('critical');
      
      const slackDeliveries = notificationSuite.getSlackService().getSuccessfulDeliveries();
      expect(slackDeliveries).toHaveLength(1);
      
      const delivery = slackDeliveries[0];
      expect(delivery.attachments).toBeDefined();
      expect(delivery.attachments?.length).toBeGreaterThan(0);
      expect(delivery.text).toContain('🚨');
      expect(delivery.username).toBe('Security Bot');
    });

    test('should create Microsoft Teams adaptive cards', async ({ page }) => {
      await notificationSuite.simulateWorkflowFailure();
      
      const teamsDeliveries = notificationSuite.getTeamsService().getSuccessfulDeliveries();
      expect(teamsDeliveries).toHaveLength(1);
      
      const delivery = teamsDeliveries[0];
      expect(delivery.card_content.attachments).toBeDefined();
      expect(delivery.card_content.attachments[0].contentType).toBe('application/vnd.microsoft.card.adaptive');
      expect(delivery.card_content.attachments[0].content.type).toBe('AdaptiveCard');
    });
  });

  // ===== USER EXPERIENCE TESTS (High Priority) =====

  test.describe('Notification Configuration Interface', () => {
    test('should allow users to configure notification preferences', async ({ page }) => {
      // Navigate to notification preferences
      await preferencesPage.navigateToNotificationPreferences();
      
      // Configure email channel
      await preferencesPage.configureEmailChannel(
        ['admin@example.com', 'security@example.com'], 
        'html'
      );
      
      // Configure Slack channel
      await preferencesPage.configureSlackChannel(
        'https://hooks.slack.com/services/test',
        '#security-alerts',
        'SecurityBot'
      );
      
      // Set notification frequency
      await preferencesPage.setNotificationFrequency('batched');
      
      // Configure content filters
      await preferencesPage.configureContentFilters(
        ['security_alerts', 'workflow_failures'],
        ['critical', 'high']
      );
      
      // Configure quiet hours
      await preferencesPage.configureQuietHours(true, '22:00', '08:00', 'UTC');
      
      // Enable emergency override
      await preferencesPage.enableEmergencyOverride(true);
      
      // Save preferences
      await preferencesPage.savePreferences();
    });

    test('should provide real-time notification preview', async ({ page }) => {
      await preferencesPage.navigateToNotificationPreferences();
      await preferencesPage.previewNotification();
      
      // Should show preview of how notifications will look
      await expect(page.getByTestId('notification-preview')).toBeVisible();
      await expect(page.getByText('Preview: Security Vulnerability Detected')).toBeVisible();
    });

    test('should support bulk configuration across repositories', async ({ page }) => {
      await preferencesPage.navigateToNotificationPreferences();
      
      // Should have option to apply settings to all repositories
      const bulkApplyButton = page.getByRole('button', { name: 'Apply to All Repositories' });
      await expect(bulkApplyButton).toBeVisible();
      
      await bulkApplyButton.click();
      await expect(page.getByText('Settings applied to all repositories')).toBeVisible();
    });
  });

  test.describe('In-App Notification Center', () => {
    test('should display notifications in the notification center', async ({ page }) => {
      // Trigger some test notifications
      await notificationSuite.simulateSecurityAlert('high');
      await notificationSuite.simulateWorkflowFailure();
      
      // Open notification center
      await notificationCenter.openNotificationCenter();
      
      // Should show notifications
      await expect.poll(async () => {
        return await notificationCenter.getNotificationCount();
      }, { timeout: 10000 }).toBeGreaterThan(0);
      
      // Verify notification details
      const hasSecurityAlert = await notificationCenter.verifyNotificationExists({
        title: 'Security Vulnerability Detected',
        type: 'security_alert',
        severity: 'high'
      });
      expect(hasSecurityAlert).toBeTruthy();
      
      const hasWorkflowFailure = await notificationCenter.verifyNotificationExists({
        title: 'CodeQL Workflow Failed',
        type: 'workflow_failure'
      });
      expect(hasWorkflowFailure).toBeTruthy();
    });

    test('should support notification filtering and search', async ({ page }) => {
      // Create diverse notifications
      await notificationSuite.simulateSecurityAlert('critical');
      await notificationSuite.simulateComplianceViolation();
      await notificationSuite.simulateWorkflowFailure();
      
      await notificationCenter.openNotificationCenter();
      
      // Test filtering by type
      await notificationCenter.filterNotifications('security');
      const securityCount = await notificationCenter.getNotificationCount();
      expect(securityCount).toBeGreaterThan(0);
      
      // Test search functionality
      await notificationCenter.searchNotifications('vulnerability');
      await expect.poll(async () => {
        return await notificationCenter.getNotificationCount();
      }).toBe(1);
      
      await notificationCenter.clearSearch();
      await notificationCenter.filterNotifications('all');
    });

    test('should handle notification interactions (mark as read, clear)', async ({ page }) => {
      await notificationSuite.simulateSecurityAlert('medium');
      
      await notificationCenter.openNotificationCenter();
      
      // Mark individual notification as read
      await notificationCenter.markNotificationAsRead(0);
      
      // Verify read state changed
      const details = await notificationCenter.getNotificationDetails(0);
      expect(details.isRead).toBeTruthy();
      
      // Test mark all as read
      await notificationSuite.simulateWorkflowFailure();
      await notificationCenter.markAllNotificationsAsRead();
      
      expect(await notificationCenter.getUnreadNotificationCount()).toBe(0);
    });
  });

  // ===== INTEGRATION TESTS (High Priority) =====

  test.describe('External Service Integration', () => {
    test('should handle email service failures gracefully', async ({ page }) => {
      // Configure email service to fail 50% of the time
      const failingNotificationSuite = new NotificationTestSuite(page, { emailFailureRate: 0.5 });
      
      // Trigger multiple notifications
      for (let i = 0; i < 10; i++) {
        await failingNotificationSuite.simulateSecurityAlert('high');
      }
      
      // Check that some failed and some succeeded
      const stats = failingNotificationSuite.getDeliveryStats();
      expect(stats.email.failed).toBeGreaterThan(0);
      expect(stats.email.successful).toBeGreaterThan(0);
      
      // Other channels should still work
      expect(stats.slack.successful).toBe(10);
      expect(stats.teams.successful).toBe(10);
      
      failingNotificationSuite.clearAllDeliveries();
    });

    test('should respect Slack rate limiting', async ({ page }) => {
      // Configure Slack service with rate limiting
      const slackService = notificationSuite.getSlackService();
      slackService.simulateRateLimiting(1000); // 1 second delay
      
      const startTime = Date.now();
      
      // Send multiple notifications quickly
      await notificationSuite.simulateSecurityAlert('high');
      await notificationSuite.simulateWorkflowFailure();
      
      const endTime = Date.now();
      const elapsed = endTime - startTime;
      
      // Should take at least the rate limit delay
      expect(elapsed).toBeGreaterThan(1000);
      
      slackService.removeRateLimiting();
    });

    test('should handle Teams webhook failures with retry', async ({ page }) => {
      // Configure Teams service to fail initially
      const teamsFailingSuite = new NotificationTestSuite(page, { teamsFailureRate: 1.0 });
      
      await teamsFailingSuite.simulateSecurityAlert('critical');
      
      // Should have failed delivery
      const stats = teamsFailingSuite.getDeliveryStats();
      expect(stats.teams.failed).toBe(1);
      expect(stats.teams.successful).toBe(0);
      
      // Other channels should still work
      expect(stats.email.successful).toBe(1);
      expect(stats.slack.successful).toBe(1);
    });
  });

  // ===== RELIABILITY AND PERFORMANCE TESTS =====

  test.describe('Delivery Reliability', () => {
    test('should handle high-volume notification processing', async ({ page }) => {
      const notifications = [];
      const startTime = Date.now();
      
      // Generate 50 notifications rapidly
      for (let i = 0; i < 50; i++) {
        notifications.push(notificationSuite.simulateSecurityAlert('medium', `test-org/repo-${i}`));
      }
      
      await Promise.all(notifications);
      const endTime = Date.now();
      
      // Should complete in reasonable time (under 30 seconds)
      expect(endTime - startTime).toBeLessThan(30000);
      
      // Verify all notifications were delivered
      const stats = notificationSuite.getDeliveryStats();
      expect(stats.email.successful).toBe(50);
      expect(stats.slack.successful).toBe(50);
      expect(stats.teams.successful).toBe(50);
    });

    test('should prevent duplicate notifications for same event', async ({ page }) => {
      const eventId = 'duplicate-test-' + Date.now();
      
      // Simulate the same event multiple times (could happen due to webhook retries)
      await page.route('**/api/notifications/trigger', (route) => {
        if (route.request().postData()?.includes(eventId)) {
          // First call succeeds
          if (!route.request().url().includes('duplicate_handled')) {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ event_id: eventId, status: 'processed', deduplication: 'new' })
            });
          } else {
            // Subsequent calls are deduplicated
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ event_id: eventId, status: 'deduplicated', deduplication: 'duplicate' })
            });
          }
        } else {
          route.continue();
        }
      });
      
      // Trigger same event multiple times
      const event = await notificationSuite.simulateSecurityAlert('high');
      await notificationSuite.simulateSecurityAlert('high'); // Should be deduplicated
      
      // Should only have one set of notifications delivered
      const stats = notificationSuite.getDeliveryStats();
      expect(stats.email.successful).toBe(1);
      expect(stats.slack.successful).toBe(1);
      expect(stats.teams.successful).toBe(1);
    });
  });

  test.describe('Escalation Workflows', () => {
    test('should escalate critical alerts after time threshold', async ({ page }) => {
      const startTime = Date.now();
      
      // Trigger critical alert
      const event = await notificationSuite.simulateSecurityAlert('critical');
      
      // Test escalation workflow
      await notificationSuite.testEscalationWorkflow({
        initialEvent: event,
        escalationDelayMs: 1000, // 1 second for testing
        escalationChannels: ['email', 'slack']
      });
      
      // Should have received escalation notifications
      const stats = notificationSuite.getDeliveryStats();
      expect(stats.email.successful).toBeGreaterThan(1);
      expect(stats.slack.successful).toBeGreaterThan(1);
      
      // Verify escalation content
      const emailDeliveries = notificationSuite.getEmailService().getSuccessfulDeliveries();
      const hasEscalation = emailDeliveries.some(delivery => 
        delivery.subject.includes('[ESCALATED]')
      );
      expect(hasEscalation).toBeTruthy();
    });
  });

  // ===== USER PREFERENCE MANAGEMENT TESTS =====

  test.describe('User Preference Validation', () => {
    test('should respect quiet hours configuration', async ({ page }) => {
      await preferencesPage.navigateToNotificationPreferences();
      
      // Set quiet hours for current time (simulate being in quiet period)
      const now = new Date();
      const quietStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const quietEnd = new Date(now.getTime() + 60 * 60 * 1000);   // 1 hour from now
      
      await preferencesPage.configureQuietHours(
        true,
        quietStart.toTimeString().slice(0, 5),
        quietEnd.toTimeString().slice(0, 5),
        'UTC'
      );
      await preferencesPage.savePreferences();
      
      // Trigger non-emergency notification
      await notificationSuite.simulateRepositoryStatusChange();
      
      // Should be suppressed during quiet hours (except for emergency override)
      const stats = notificationSuite.getDeliveryStats();
      expect(stats.email.successful).toBe(0);
      expect(stats.slack.successful).toBe(0);
    });

    test('should allow emergency override during quiet hours', async ({ page }) => {
      await preferencesPage.navigateToNotificationPreferences();
      await preferencesPage.enableEmergencyOverride(true);
      await preferencesPage.savePreferences();
      
      // Trigger critical alert (should override quiet hours)
      await notificationSuite.simulateSecurityAlert('critical');
      
      // Should be delivered despite quiet hours
      const stats = notificationSuite.getDeliveryStats();
      expect(stats.email.successful).toBeGreaterThan(0);
      expect(stats.slack.successful).toBeGreaterThan(0);
    });

    test('should filter notifications by severity and type', async ({ page }) => {
      await preferencesPage.navigateToNotificationPreferences();
      
      // Configure to only receive critical security alerts
      await preferencesPage.configureContentFilters(
        ['security_alerts'],
        ['critical']
      );
      await preferencesPage.savePreferences();
      
      // Trigger various notifications
      await notificationSuite.simulateSecurityAlert('critical');  // Should be delivered
      await notificationSuite.simulateSecurityAlert('medium');    // Should be filtered
      await notificationSuite.simulateWorkflowFailure();          // Should be filtered
      
      // Only critical security alert should be delivered
      const stats = notificationSuite.getDeliveryStats();
      expect(stats.email.successful).toBe(1);
      expect(stats.slack.successful).toBe(1);
      expect(stats.teams.successful).toBe(1);
    });
  });

  // Mobile responsiveness test
  test('should work correctly on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to notification preferences on mobile
    await preferencesPage.navigateToNotificationPreferences();
    
    // Should be responsive and usable
    await expect(preferencesPage.preferencesContainer).toBeVisible();
    await expect(preferencesPage.emailToggle).toBeVisible();
    
    // Test basic functionality on mobile
    await preferencesPage.enableChannel('email');
    await preferencesPage.configureEmailChannel(['mobile@example.com']);
    
    // Trigger notification and verify mobile notification center
    await notificationSuite.simulateSecurityAlert('high');
    
    await notificationCenter.openNotificationCenter();
    await expect.poll(async () => {
      return await notificationCenter.getNotificationCount();
    }).toBeGreaterThan(0);
  });
});