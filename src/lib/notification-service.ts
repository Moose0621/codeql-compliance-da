import { v4 as uuidv4 } from 'uuid';
import type { 
  Notification, 
  NotificationPreferences, 
  NotificationHistory,
  NotificationAction,
  SecurityFindings,
  Repository
} from '@/types/dashboard';
import { logInfo, logWarn, logError } from './logger';

/**
 * Centralized notification service for managing notifications across the application.
 * Handles persistence, delivery via multiple channels, and preference management.
 */
export class NotificationService {
  private static instance: NotificationService;
  private readonly STORAGE_KEY = 'notification-history';
  private readonly MAX_NOTIFICATIONS = 500; // Keep last 500 notifications
  private readonly CLEANUP_THRESHOLD = 1000; // Cleanup when we reach this many
  
  private history: NotificationHistory;
  private listeners: Set<(history: NotificationHistory) => void> = new Set();
  
  private constructor() {
    this.history = this.loadHistory();
    this.requestDesktopPermission();
  }
  
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Add a listener for notification history changes
   */
  public addListener(callback: (history: NotificationHistory) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Get current notification history
   */
  public getHistory(): NotificationHistory {
    return { ...this.history };
  }

  /**
   * Create and deliver a notification
   */
  public async createNotification(
    type: Notification['type'],
    severity: Notification['severity'],
    title: string,
    message: string,
    options: {
      repository?: string;
      actions?: NotificationAction[];
      metadata?: Notification['metadata'];
      skipDelivery?: boolean;
    } = {}
  ): Promise<string> {
    const notification: Notification = {
      id: uuidv4(),
      type,
      severity,
      title,
      message,
      repository: options.repository,
      timestamp: new Date().toISOString(),
      read: false,
      actions: options.actions,
      metadata: options.metadata,
    };

    // Add to history
    this.addToHistory(notification);

    // Deliver via configured channels
    if (!options.skipDelivery) {
      await this.deliverNotification(notification);
    }

    logInfo(`Created notification: ${notification.title}`);
    return notification.id;
  }

  /**
   * Create security alert notification from scan results
   */
  public async createSecurityAlert(
    repository: Repository,
    findings: SecurityFindings,
    options: { scanId?: string; workflowRunId?: number } = {}
  ): Promise<string> {
    const criticalCount = findings.critical;
    const highCount = findings.high;
    const totalCount = findings.total;
    
    let severity: Notification['severity'];
    let title: string;
    let message: string;

    if (criticalCount > 0) {
      severity = 'critical';
      title = `Critical Security Alert: ${repository.name}`;
      message = `Found ${criticalCount} critical vulnerabilities${highCount > 0 ? ` and ${highCount} high severity` : ''} (${totalCount} total findings)`;
    } else if (highCount > 0) {
      severity = 'high';
      title = `High Severity Alert: ${repository.name}`;
      message = `Found ${highCount} high severity vulnerabilities (${totalCount} total findings)`;
    } else if (totalCount > 0) {
      severity = 'medium';
      title = `Security Findings: ${repository.name}`;
      message = `Found ${totalCount} security findings requiring review`;
    } else {
      severity = 'info';
      title = `Clean Scan: ${repository.name}`;
      message = 'No security vulnerabilities detected in latest scan';
    }

    const actions: NotificationAction[] = [
      {
        label: 'View Details',
        action: 'view_details',
        metadata: { repositoryId: repository.id, repositoryName: repository.name }
      }
    ];

    if (totalCount > 0) {
      actions.push({
        label: 'Export Report',
        action: 'export_report',
        metadata: { repositoryId: repository.id, format: 'pdf' }
      });
    }

    return this.createNotification('security_alert', severity, title, message, {
      repository: repository.name,
      actions,
      metadata: {
        scanId: options.scanId,
        findingCount: totalCount,
        repositoryId: repository.id,
        workflowRunId: options.workflowRunId,
      }
    });
  }

  /**
   * Create scan completion notification
   */
  public async createScanCompleteNotification(
    repository: Repository,
    success: boolean,
    duration?: number
  ): Promise<string> {
    const severity: Notification['severity'] = success ? 'info' : 'medium';
    const title = success ? `Scan Complete: ${repository.name}` : `Scan Failed: ${repository.name}`;
    const message = success 
      ? `CodeQL scan completed successfully${duration ? ` in ${Math.round(duration / 1000)}s` : ''}`
      : 'CodeQL scan failed - check workflow logs for details';

    const actions: NotificationAction[] = [
      {
        label: success ? 'View Results' : 'View Logs',
        action: 'view_details',
        metadata: { repositoryId: repository.id, repositoryName: repository.name }
      }
    ];

    if (success) {
      actions.push({
        label: 'Refresh Data',
        action: 'refresh_scan',
        metadata: { repositoryId: repository.id }
      });
    }

    return this.createNotification('scan_complete', severity, title, message, {
      repository: repository.name,
      actions,
      metadata: { repositoryId: repository.id }
    });
  }

  /**
   * Mark notification as read
   */
  public markAsRead(notificationId: string): boolean {
    const notification = this.history.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      this.updateUnreadCount();
      this.saveHistory();
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Mark all notifications as read
   */
  public markAllAsRead(): number {
    let count = 0;
    this.history.notifications.forEach(notification => {
      if (!notification.read) {
        notification.read = true;
        count++;
      }
    });
    
    if (count > 0) {
      this.updateUnreadCount();
      this.saveHistory();
      this.notifyListeners();
    }
    
    return count;
  }

  /**
   * Get notification preferences
   */
  public getPreferences(): NotificationPreferences {
    return { ...this.history.preferences };
  }

  /**
   * Update notification preferences
   */
  public updatePreferences(preferences: Partial<NotificationPreferences>): void {
    this.history.preferences = { ...this.history.preferences, ...preferences };
    this.saveHistory();
    this.notifyListeners();
    logInfo('Notification preferences updated');
  }

  /**
   * Clear all notifications
   */
  public clearAll(): number {
    const count = this.history.notifications.length;
    this.history.notifications = [];
    this.history.unreadCount = 0;
    this.saveHistory();
    this.notifyListeners();
    logInfo(`Cleared ${count} notifications`);
    return count;
  }

  /**
   * Delete specific notification
   */
  public deleteNotification(notificationId: string): boolean {
    const index = this.history.notifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
      const wasUnread = !this.history.notifications[index].read;
      this.history.notifications.splice(index, 1);
      if (wasUnread) {
        this.updateUnreadCount();
      }
      this.saveHistory();
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Request desktop notification permission
   */
  public async requestDesktopPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      logWarn('Desktop notifications not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.updateDesktopPermission(true);
      return true;
    }

    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        const granted = permission === 'granted';
        this.updateDesktopPermission(granted);
        return granted;
      } catch (error) {
        logError('Failed to request notification permission:', error);
        return false;
      }
    }

    this.updateDesktopPermission(false);
    return false;
  }

  // Private methods

  private addToHistory(notification: Notification): void {
    this.history.notifications.unshift(notification);
    this.updateUnreadCount();
    this.cleanupIfNeeded();
    this.saveHistory();
    this.notifyListeners();
  }

  private async deliverNotification(notification: Notification): Promise<void> {
    const prefs = this.history.preferences;
    const categoryPrefs = prefs.categories[notification.type];
    
    if (!categoryPrefs?.enabled) {
      return;
    }

    // Check severity filter for applicable types
    if ('minSeverity' in categoryPrefs) {
      const severityLevels = ['info', 'low', 'medium', 'high', 'critical'];
      const notificationLevel = severityLevels.indexOf(notification.severity);
      const minLevel = severityLevels.indexOf(categoryPrefs.minSeverity);
      
      if (notificationLevel < minLevel) {
        return;
      }
    }

    // Check quiet hours
    if (prefs.quietHours.enabled && this.isInQuietHours()) {
      logInfo(`Notification suppressed due to quiet hours: ${notification.title}`);
      return;
    }

    // Deliver via configured channels
    const channels = categoryPrefs.channels || [];
    
    if (channels.includes('toast') && prefs.channels.toast) {
      this.deliverToast(notification);
    }
    
    if (channels.includes('desktop') && prefs.channels.desktop && prefs.desktop.enabled) {
      await this.deliverDesktop(notification);
    }
    
    if (channels.includes('email') && prefs.channels.email && prefs.email.enabled) {
      await this.deliverEmail(notification);
    }
  }

  private deliverToast(notification: Notification): void {
    // Import toast dynamically to avoid circular dependencies
    import('sonner').then(({ toast }) => {
      const toastFn = notification.severity === 'critical' || notification.severity === 'high' 
        ? toast.error 
        : notification.severity === 'medium' 
        ? toast.warning 
        : toast.info;
        
      toastFn(notification.title, {
        description: notification.message,
        duration: notification.severity === 'critical' ? 10000 : 5000,
      });
    });
  }

  private async deliverDesktop(notification: Notification): Promise<void> {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    try {
      const desktopNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
        requireInteraction: notification.severity === 'critical',
      });

      // Auto-close after delay unless critical
      if (notification.severity !== 'critical') {
        setTimeout(() => desktopNotification.close(), 10000);
      }

      desktopNotification.onclick = () => {
        window.focus();
        this.markAsRead(notification.id);
        desktopNotification.close();
      };
    } catch (error) {
      logError('Failed to show desktop notification:', error);
    }
  }

  private async deliverEmail(notification: Notification): Promise<void> {
    // Email delivery would integrate with backend service
    // For now, just log the intent
    logInfo(`Would send email notification: ${notification.title} to ${this.history.preferences.email.address}`);
    
    // TODO: Implement actual email delivery via backend API
    // This would typically POST to /api/notifications/email with notification data
  }

  private isInQuietHours(): boolean {
    const { quietHours } = this.history.preferences;
    if (!quietHours.enabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return currentTime >= quietHours.startTime && currentTime <= quietHours.endTime;
  }

  private updateUnreadCount(): void {
    this.history.unreadCount = this.history.notifications.filter(n => !n.read).length;
  }

  private updateDesktopPermission(granted: boolean): void {
    this.history.preferences.desktop.permissionGranted = granted;
    this.saveHistory();
  }

  private cleanupIfNeeded(): void {
    if (this.history.notifications.length > this.CLEANUP_THRESHOLD) {
      // Keep only the most recent MAX_NOTIFICATIONS
      this.history.notifications = this.history.notifications
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, this.MAX_NOTIFICATIONS);
      
      this.history.lastCleanup = new Date().toISOString();
      logInfo(`Cleaned up notifications, kept ${this.MAX_NOTIFICATIONS} most recent`);
    }
  }

  private loadHistory(): NotificationHistory {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as NotificationHistory;
          // Ensure all required fields exist with defaults
          return {
            notifications: parsed.notifications || [],
            unreadCount: parsed.unreadCount || 0,
            lastCleanup: parsed.lastCleanup || new Date().toISOString(),
            preferences: {
              ...this.getDefaultPreferences(),
              ...parsed.preferences
            }
          };
        }
      }
    } catch (error) {
      logError('Failed to load notification history:', error);
    }
    
    return {
      notifications: [],
      unreadCount: 0,
      lastCleanup: new Date().toISOString(),
      preferences: this.getDefaultPreferences()
    };
  }

  private saveHistory(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.history));
      }
    } catch (error) {
      logError('Failed to save notification history:', error);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback(this.getHistory());
      } catch (error) {
        logError('Notification listener error:', error);
      }
    });
  }

  private getDefaultPreferences(): NotificationPreferences {
    return {
      channels: {
        toast: true,
        desktop: false,
        email: false,
      },
      categories: {
        security_alert: {
          enabled: true,
          minSeverity: 'medium',
          channels: ['toast', 'desktop']
        },
        scan_complete: {
          enabled: true,
          channels: ['toast']
        },
        compliance_warning: {
          enabled: true,
          minSeverity: 'high',
          channels: ['toast', 'desktop']
        },
        system_update: {
          enabled: true,
          channels: ['toast']
        }
      },
      email: {
        enabled: false,
      },
      desktop: {
        enabled: false,
        permissionGranted: false,
      },
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
      }
    };
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();