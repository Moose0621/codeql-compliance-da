import { useState, useEffect, useCallback } from 'react';
import { notificationService } from '@/lib/notification-service';
import type { 
  NotificationHistory, 
  NotificationPreferences, 
  Notification, 
  NotificationAction 
} from '@/types/dashboard';

/**
 * Custom hook for managing notifications throughout the application
 */
export function useNotifications() {
  const [history, setHistory] = useState<NotificationHistory>(() => 
    notificationService.getHistory()
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Subscribe to notification updates
    const unsubscribe = notificationService.addListener(setHistory);
    return unsubscribe;
  }, []);

  const createNotification = useCallback(async (
    type: Notification['type'],
    severity: Notification['severity'],
    title: string,
    message: string,
    options?: {
      repository?: string;
      actions?: NotificationAction[];
      metadata?: Notification['metadata'];
      skipDelivery?: boolean;
    }
  ): Promise<string> => {
    setIsLoading(true);
    try {
      const id = await notificationService.createNotification(
        type, severity, title, message, options
      );
      return id;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    return notificationService.markAsRead(notificationId);
  }, []);

  const markAllAsRead = useCallback(() => {
    return notificationService.markAllAsRead();
  }, []);

  const deleteNotification = useCallback((notificationId: string) => {
    return notificationService.deleteNotification(notificationId);
  }, []);

  const clearAll = useCallback(() => {
    return notificationService.clearAll();
  }, []);

  const updatePreferences = useCallback((preferences: Partial<NotificationPreferences>) => {
    notificationService.updatePreferences(preferences);
  }, []);

  const requestDesktopPermission = useCallback(async () => {
    setIsLoading(true);
    try {
      const granted = await notificationService.requestDesktopPermission();
      return granted;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Computed values
  const unreadNotifications = history.notifications.filter(n => !n.read);
  const notificationsByType = {
    security_alert: history.notifications.filter(n => n.type === 'security_alert'),
    scan_complete: history.notifications.filter(n => n.type === 'scan_complete'),
    compliance_warning: history.notifications.filter(n => n.type === 'compliance_warning'),
    system_update: history.notifications.filter(n => n.type === 'system_update'),
  };

  const recentNotifications = history.notifications
    .slice(0, 10)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    // State
    notifications: history.notifications,
    unreadCount: history.unreadCount,
    preferences: history.preferences,
    isLoading,
    
    // Computed
    unreadNotifications,
    notificationsByType,
    recentNotifications,
    
    // Actions
    createNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    updatePreferences,
    requestDesktopPermission,
    
    // Utilities
    hasUnread: history.unreadCount > 0,
    totalCount: history.notifications.length,
  };
}

/**
 * Hook for notification preferences management
 */
export function useNotificationPreferences() {
  const { preferences, updatePreferences, requestDesktopPermission, isLoading } = useNotifications();

  const toggleChannel = useCallback((channel: keyof NotificationPreferences['channels']) => {
    updatePreferences({
      channels: {
        ...preferences.channels,
        [channel]: !preferences.channels[channel]
      }
    });
  }, [preferences.channels, updatePreferences]);

  const toggleCategory = useCallback((
    category: keyof NotificationPreferences['categories'],
    enabled?: boolean
  ) => {
    updatePreferences({
      categories: {
        ...preferences.categories,
        [category]: {
          ...preferences.categories[category],
          enabled: enabled !== undefined ? enabled : !preferences.categories[category].enabled
        }
      }
    });
  }, [preferences.categories, updatePreferences]);

  const updateCategoryChannels = useCallback((
    category: keyof NotificationPreferences['categories'],
    channels: string[]
  ) => {
    updatePreferences({
      categories: {
        ...preferences.categories,
        [category]: {
          ...preferences.categories[category],
          channels: channels as ('toast' | 'desktop' | 'email')[]
        }
      }
    });
  }, [preferences.categories, updatePreferences]);

  const updateMinSeverity = useCallback((
    category: 'security_alert' | 'compliance_warning',
    minSeverity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  ) => {
    updatePreferences({
      categories: {
        ...preferences.categories,
        [category]: {
          ...preferences.categories[category],
          minSeverity
        }
      }
    });
  }, [preferences.categories, updatePreferences]);

  const updateQuietHours = useCallback((
    quietHours: Partial<NotificationPreferences['quietHours']>
  ) => {
    updatePreferences({
      quietHours: {
        ...preferences.quietHours,
        ...quietHours
      }
    });
  }, [preferences.quietHours, updatePreferences]);

  const updateEmailSettings = useCallback((
    email: Partial<NotificationPreferences['email']>
  ) => {
    updatePreferences({
      email: {
        ...preferences.email,
        ...email
      }
    });
  }, [preferences.email, updatePreferences]);

  const enableDesktopNotifications = useCallback(async () => {
    const granted = await requestDesktopPermission();
    if (granted) {
      updatePreferences({
        desktop: {
          ...preferences.desktop,
          enabled: true
        }
      });
    }
    return granted;
  }, [preferences.desktop, requestDesktopPermission, updatePreferences]);

  return {
    preferences,
    isLoading,
    
    // Actions
    toggleChannel,
    toggleCategory,
    updateCategoryChannels,
    updateMinSeverity,
    updateQuietHours,
    updateEmailSettings,
    enableDesktopNotifications,
    updatePreferences,
    
    // Computed
    canUseDesktop: 'Notification' in window,
    desktopEnabled: preferences.desktop.enabled && preferences.desktop.permissionGranted,
    emailConfigured: preferences.email.enabled && !!preferences.email.address,
  };
}