// Page Object Model for In-App Notification Center
import { type Page, type Locator, expect } from '@playwright/test';

export class NotificationCenterPage {
  readonly page: Page;
  
  // Main elements
  readonly notificationBell: Locator;
  readonly notificationCenter: Locator;
  readonly notificationBadge: Locator;
  readonly clearAllButton: Locator;
  readonly markAllReadButton: Locator;
  readonly filterDropdown: Locator;
  
  // Filters
  readonly filterAll: Locator;
  readonly filterUnread: Locator;
  readonly filterSecurity: Locator;
  readonly filterCompliance: Locator;
  readonly filterWorkflow: Locator;
  
  // Notification items
  readonly notificationItems: Locator;
  readonly unreadNotifications: Locator;
  readonly readNotifications: Locator;
  
  // Toast notifications
  readonly toastContainer: Locator;
  readonly activeToasts: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Main elements
    this.notificationBell = page.getByTestId('notification-bell');
    this.notificationCenter = page.getByTestId('notification-center');
    this.notificationBadge = page.getByTestId('notification-badge');
    this.clearAllButton = page.getByRole('button', { name: 'Clear All' });
    this.markAllReadButton = page.getByRole('button', { name: 'Mark All Read' });
    this.filterDropdown = page.getByTestId('notification-filter');
    
    // Filters
    this.filterAll = page.getByRole('option', { name: 'All Notifications' });
    this.filterUnread = page.getByRole('option', { name: 'Unread Only' });
    this.filterSecurity = page.getByRole('option', { name: 'Security Alerts' });
    this.filterCompliance = page.getByRole('option', { name: 'Compliance' });
    this.filterWorkflow = page.getByRole('option', { name: 'Workflow Issues' });
    
    // Notification items
    this.notificationItems = page.getByTestId('notification-item');
    this.unreadNotifications = page.getByTestId('notification-item').filter({ hasText: 'unread' });
    this.readNotifications = page.getByTestId('notification-item').filter({ hasText: 'read' });
    
    // Toast notifications
    this.toastContainer = page.getByTestId('toast-container');
    this.activeToasts = page.locator('.sonner-toast');
  }

  async openNotificationCenter(): Promise<void> {
    await this.notificationBell.click();
    await expect(this.notificationCenter).toBeVisible();
  }

  async closeNotificationCenter(): Promise<void> {
    // Click outside to close
    await this.page.click('body', { position: { x: 0, y: 0 } });
    await expect(this.notificationCenter).not.toBeVisible();
  }

  async getNotificationBadgeCount(): Promise<number> {
    const badgeText = await this.notificationBadge.textContent();
    return badgeText ? parseInt(badgeText, 10) : 0;
  }

  async getNotificationCount(): Promise<number> {
    return await this.notificationItems.count();
  }

  async getUnreadNotificationCount(): Promise<number> {
    return await this.unreadNotifications.count();
  }

  async markNotificationAsRead(index: number = 0): Promise<void> {
    const notification = this.notificationItems.nth(index);
    const markReadButton = notification.getByRole('button', { name: 'Mark as Read' });
    
    await markReadButton.click();
    
    // Wait for UI to update
    await expect(notification.getByTestId('read-indicator')).toBeVisible();
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.markAllReadButton.click();
    
    // Wait for all notifications to be marked as read
    await expect(this.unreadNotifications).toHaveCount(0);
  }

  async clearAllNotifications(): Promise<void> {
    await this.clearAllButton.click();
    
    // Confirm in dialog
    await this.page.getByRole('button', { name: 'Clear All' }).click();
    
    // Wait for notifications to be cleared
    await expect(this.notificationItems).toHaveCount(0);
    await expect(this.page.getByText('No notifications')).toBeVisible();
  }

  async filterNotifications(filter: 'all' | 'unread' | 'security' | 'compliance' | 'workflow'): Promise<void> {
    await this.filterDropdown.click();
    
    switch (filter) {
      case 'all':
        await this.filterAll.click();
        break;
      case 'unread':
        await this.filterUnread.click();
        break;
      case 'security':
        await this.filterSecurity.click();
        break;
      case 'compliance':
        await this.filterCompliance.click();
        break;
      case 'workflow':
        await this.filterWorkflow.click();
        break;
    }
    
    // Wait for filter to apply
    await this.page.waitForTimeout(500);
  }

  async clickNotification(index: number = 0): Promise<void> {
    const notification = this.notificationItems.nth(index);
    await notification.click();
    
    // Should navigate to the related page or show details
    await this.page.waitForTimeout(1000);
  }

  async getNotificationDetails(index: number = 0): Promise<{
    title: string;
    message: string;
    timestamp: string;
    type: string;
    severity: string;
    isRead: boolean;
  }> {
    const notification = this.notificationItems.nth(index);
    
    const title = await notification.getByTestId('notification-title').textContent() || '';
    const message = await notification.getByTestId('notification-message').textContent() || '';
    const timestamp = await notification.getByTestId('notification-timestamp').textContent() || '';
    const type = await notification.getByTestId('notification-type').textContent() || '';
    const severity = await notification.getByTestId('notification-severity').textContent() || '';
    const isRead = await notification.getByTestId('read-indicator').isVisible();
    
    return {
      title,
      message,
      timestamp,
      type,
      severity,
      isRead
    };
  }

  async verifyNotificationExists(expectedContent: {
    title?: string;
    message?: string;
    type?: string;
    severity?: string;
  }): Promise<boolean> {
    const count = await this.notificationItems.count();
    
    for (let i = 0; i < count; i++) {
      const details = await this.getNotificationDetails(i);
      
      if (expectedContent.title && !details.title.includes(expectedContent.title)) {
        continue;
      }
      
      if (expectedContent.message && !details.message.includes(expectedContent.message)) {
        continue;
      }
      
      if (expectedContent.type && !details.type.includes(expectedContent.type)) {
        continue;
      }
      
      if (expectedContent.severity && !details.severity.includes(expectedContent.severity)) {
        continue;
      }
      
      return true;
    }
    
    return false;
  }

  // Toast notification methods
  async waitForToastNotification(timeout: number = 5000): Promise<void> {
    await expect(this.activeToasts.first()).toBeVisible({ timeout });
  }

  async getToastCount(): Promise<number> {
    return await this.activeToasts.count();
  }

  async getToastContent(index: number = 0): Promise<{
    title: string;
    message: string;
  }> {
    const toast = this.activeToasts.nth(index);
    
    const title = await toast.locator('[data-title]').textContent() || '';
    const message = await toast.locator('[data-description]').textContent() || '';
    
    return { title, message };
  }

  async dismissToast(index: number = 0): Promise<void> {
    const toast = this.activeToasts.nth(index);
    const dismissButton = toast.getByRole('button', { name: 'Dismiss' });
    
    if (await dismissButton.isVisible()) {
      await dismissButton.click();
    }
    
    await expect(toast).not.toBeVisible();
  }

  async dismissAllToasts(): Promise<void> {
    const count = await this.getToastCount();
    
    for (let i = 0; i < count; i++) {
      // Always dismiss the first toast since they shift after dismissal
      const toast = this.activeToasts.first();
      if (await toast.isVisible()) {
        const dismissButton = toast.getByRole('button', { name: 'Dismiss' });
        if (await dismissButton.isVisible()) {
          await dismissButton.click();
        }
      }
    }
    
    await expect(this.activeToasts).toHaveCount(0);
  }

  async verifyToastNotification(expectedContent: {
    title?: string;
    message?: string;
  }): Promise<boolean> {
    await this.waitForToastNotification();
    
    const count = await this.getToastCount();
    
    for (let i = 0; i < count; i++) {
      const content = await this.getToastContent(i);
      
      if (expectedContent.title && !content.title.includes(expectedContent.title)) {
        continue;
      }
      
      if (expectedContent.message && !content.message.includes(expectedContent.message)) {
        continue;
      }
      
      return true;
    }
    
    return false;
  }

  // Notification center state helpers
  async isNotificationCenterEmpty(): Promise<boolean> {
    await this.openNotificationCenter();
    const isEmpty = await this.page.getByText('No notifications').isVisible();
    await this.closeNotificationCenter();
    return isEmpty;
  }

  async hasUnreadNotifications(): Promise<boolean> {
    return (await this.getNotificationBadgeCount()) > 0;
  }

  async getLatestNotificationTimestamp(): Promise<string> {
    if (await this.getNotificationCount() === 0) {
      return '';
    }
    
    const latestNotification = await this.getNotificationDetails(0);
    return latestNotification.timestamp;
  }

  // Advanced filtering and search
  async searchNotifications(searchTerm: string): Promise<void> {
    const searchInput = this.page.getByPlaceholder('Search notifications...');
    await searchInput.fill(searchTerm);
    
    // Wait for search results
    await this.page.waitForTimeout(500);
  }

  async clearSearch(): Promise<void> {
    const searchInput = this.page.getByPlaceholder('Search notifications...');
    await searchInput.clear();
    
    // Wait for search to clear
    await this.page.waitForTimeout(500);
  }
}