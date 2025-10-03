import { useState, useEffect, useCallback, useRef } from 'react';
import type { 
  RealtimeUpdate, 
  WebhookNotification, 
  Repository, 
  ScanRequest 
} from '@/types/dashboard';
import { getWebhookService, WebhookService } from '@/lib/webhook-service';
import { toast } from 'sonner';

interface UseRealTimeUpdatesOptions {
  /** Whether to automatically connect on mount */
  autoConnect?: boolean;
  /** Custom webhook endpoint */
  webhookEndpoint?: string;
  /** Whether to show toast notifications for updates */
  showToastNotifications?: boolean;
  /** Repository update callback */
  onRepositoryUpdate?: (repositoryId: number, status: Repository['last_scan_status'], findings?: any) => void;
  /** Scan request update callback */
  onScanRequestUpdate?: (scanRequest: Partial<ScanRequest>) => void;
  /** Custom notification handler */
  onNotification?: (notification: WebhookNotification) => void;
}

interface UseRealTimeUpdatesReturn {
  /** Current connection status */
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  /** Whether the connection is active */
  isConnected: boolean;
  /** Recent notifications */
  notifications: WebhookNotification[];
  /** Number of unread notifications */
  unreadCount: number;
  /** Connect to the webhook service */
  connect: () => void;
  /** Disconnect from the webhook service */
  disconnect: () => void;
  /** Mark notifications as read */
  markAsRead: (notificationIds?: string[]) => void;
  /** Clear all notifications */
  clearNotifications: () => void;
  /** Manually process a webhook event (for testing) */
  processWebhookEvent: (event: any, githubToken?: string, organization?: string) => Promise<void>;
  /** Subscribe to specific update types */
  subscribe: (type: string, callback: (update: RealtimeUpdate) => void) => () => void;
}

/**
 * Hook for managing real-time webhook updates and notifications
 */
export function useRealTimeUpdates(options: UseRealTimeUpdatesOptions = {}): UseRealTimeUpdatesReturn {
  const {
    autoConnect = false,
    webhookEndpoint,
    showToastNotifications = true,
    onRepositoryUpdate,
    onScanRequestUpdate,
    onNotification
  } = options;

  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [notifications, setNotifications] = useState<WebhookNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const webhookServiceRef = useRef<WebhookService | null>(null);
  const unsubscribeFnsRef = useRef<(() => void)[]>([]);

  // Initialize webhook service
  useEffect(() => {
    webhookServiceRef.current = getWebhookService(webhookEndpoint || '/api/webhook/events');
    
    // Subscribe to connection status changes
    const unsubscribeStatus = webhookServiceRef.current.onConnectionStatusChange(
      (status) => setConnectionStatus(status as any)
    );
    unsubscribeFnsRef.current.push(unsubscribeStatus);

    return () => {
      // Clean up subscriptions
      unsubscribeFnsRef.current.forEach(unsub => unsub());
      unsubscribeFnsRef.current = [];
    };
  }, [webhookEndpoint]);

  const handleRealtimeUpdate = useCallback((update: RealtimeUpdate) => {
    switch (update.type) {
      case 'repository_status':
        if (update.data.repositoryId && update.data.status && onRepositoryUpdate) {
          onRepositoryUpdate(update.data.repositoryId, update.data.status, update.data.findings);
        }
        break;
        
      case 'scan_completion':
        if (update.data.scanRequest && onScanRequestUpdate) {
          onScanRequestUpdate(update.data.scanRequest);
        }
        break;
        
      case 'notification':
        if (update.data.notification) {
          const notification = update.data.notification;
          
          // Add to notifications state
          setNotifications(prev => [notification, ...prev.slice(0, 99)]); // Keep last 100
          setUnreadCount(prev => prev + 1);
          
          // Show toast notification if enabled
          if (showToastNotifications) {
            const toastFn = {
              'success': toast.success,
              'error': toast.error,
              'warning': toast.warning,
              'info': toast.info
            }[notification.severity || 'info'] || toast.info;
            
            toastFn(notification.title, {
              description: notification.message,
              action: notification.repository ? {
                label: 'View',
                onClick: () => {
                  // Could trigger navigation to repository details
                  console.log('Navigate to:', notification.repository);
                }
              } : undefined
            });
          }
          
          // Call custom notification handler
          if (onNotification) {
            onNotification(notification);
          }
        }
        break;
    }
  }, [onRepositoryUpdate, onScanRequestUpdate, onNotification, showToastNotifications]);

  // Subscribe to all updates
  useEffect(() => {
    if (!webhookServiceRef.current) return;

    const unsubscribe = webhookServiceRef.current.subscribe('all', (update: RealtimeUpdate) => {
      handleRealtimeUpdate(update);
    });

    unsubscribeFnsRef.current.push(unsubscribe);

    return unsubscribe;
  }, [handleRealtimeUpdate]);

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect && webhookServiceRef.current && connectionStatus === 'disconnected') {
      webhookServiceRef.current.connect();
    }
  }, [autoConnect]);

  const connect = useCallback(() => {
    if (webhookServiceRef.current) {
      webhookServiceRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (webhookServiceRef.current) {
      webhookServiceRef.current.disconnect();
    }
  }, []);

  const markAsRead = useCallback((notificationIds?: string[]) => {
    if (notificationIds) {
      // Mark specific notifications as read
      setNotifications(prev => 
        prev.map(notif => 
          notificationIds.includes(notif.id) 
            ? { ...notif, read: true } 
            : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
    } else {
      // Mark all as read
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );
      setUnreadCount(0);
    }
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const processWebhookEvent = useCallback(async (
    event: any, 
    githubToken?: string, 
    organization?: string
  ) => {
    if (webhookServiceRef.current) {
      await webhookServiceRef.current.processWebhookEvent(event, githubToken, organization);
    }
  }, []);

  const subscribe = useCallback((type: string, callback: (update: RealtimeUpdate) => void) => {
    if (webhookServiceRef.current) {
      return webhookServiceRef.current.subscribe(type, callback);
    }
    return () => {}; // no-op unsubscribe
  }, []);

  return {
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    notifications,
    unreadCount,
    connect,
    disconnect,
    markAsRead,
    clearNotifications,
    processWebhookEvent,
    subscribe
  };
}

/**
 * Hook for simpler repository-specific real-time updates
 */
export function useRepositoryRealTimeUpdates(
  repositoryId: number,
  onStatusChange?: (status: Repository['last_scan_status'], findings?: any) => void
): {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
} {
  const { isConnected, connect, disconnect } = useRealTimeUpdates({
    autoConnect: true,
    showToastNotifications: false,
    onRepositoryUpdate: (repoId, status, findings) => {
      if (repoId === repositoryId && onStatusChange) {
        onStatusChange(status, findings);
      }
    }
  });

  return {
    isConnected,
    connect,
    disconnect
  };
}