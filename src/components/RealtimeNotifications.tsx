import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Bell, 
  BellRinging, 
  CheckCircle, 
  XCircle, 
  Warning, 
  Info, 
  WifiHigh, 
  WifiSlash,
  Eye
} from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';
import type { WebhookNotification } from '@/types/dashboard';
import { useRealTimeUpdates } from '@/hooks/useRealTimeUpdates';
import { cn } from '@/lib/utils';

interface RealtimeNotificationsProps {
  /** Whether to auto-connect on mount */
  autoConnect?: boolean;
  /** Custom webhook endpoint */
  webhookEndpoint?: string;
  /** Maximum number of notifications to display */
  maxNotifications?: number;
  /** Custom notification handlers */
  onNotificationClick?: (notification: WebhookNotification) => void;
  /** Repository update callback */
  onRepositoryUpdate?: (repositoryId: number, status: string, findings?: any) => void;
}

const severityIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: Warning,
  info: Info
};

const severityColors = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500'
};

export function RealtimeNotifications({
  autoConnect = true,
  webhookEndpoint,
  maxNotifications = 50,
  onNotificationClick,
  onRepositoryUpdate
}: RealtimeNotificationsProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const {
    connectionStatus,
    isConnected,
    notifications,
    unreadCount,
    connect,
    disconnect,
    markAsRead,
    clearNotifications
  } = useRealTimeUpdates({
    autoConnect,
    webhookEndpoint,
    showToastNotifications: true,
    onRepositoryUpdate,
    onNotification: (notification) => {
      // Optional: Add to browser notifications
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: notification.id
        });
      }
    }
  });

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleNotificationClick = (notification: WebhookNotification) => {
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    
    // Mark as read
    markAsRead([notification.id]);
  };

  const handleMarkAllAsRead = () => {
    markAsRead();
  };

  const handleClearAll = () => {
    clearNotifications();
  };

  const displayNotifications = notifications.slice(0, maxNotifications);

  const ConnectionIcon = isConnected ? WifiHigh : WifiSlash;
  const NotificationIcon = unreadCount > 0 ? BellRinging : Bell;

  return (
    <div className="flex items-center space-x-2">
      {/* Connection Status Indicator */}
      <div className={cn(
        'flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium',
        isConnected 
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          : connectionStatus === 'connecting'
          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      )}>
        <ConnectionIcon size={12} />
        <span>
          {connectionStatus === 'connected' ? 'Live' : 
           connectionStatus === 'connecting' ? 'Connecting' : 
           'Offline'}
        </span>
      </div>

      {/* Notifications Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="relative">
            <NotificationIcon size={16} />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-80 p-0" align="end">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Notifications
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {unreadCount} new
                    </Badge>
                  )}
                </CardTitle>
                
                <div className="flex items-center space-x-1">
                  {!isConnected && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={connect}
                      className="h-7 px-2 text-xs"
                    >
                      Connect
                    </Button>
                  )}
                  {isConnected && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={disconnect}
                      className="h-7 px-2 text-xs"
                    >
                      <WifiSlash size={12} />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            {displayNotifications.length > 0 && (
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-2 bg-muted/50">
                  <span className="text-xs text-muted-foreground">
                    {displayNotifications.length} notification{displayNotifications.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center space-x-2">
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleMarkAllAsRead}
                        className="h-6 px-2 text-xs"
                      >
                        <Eye size={10} className="mr-1" />
                        Mark all read
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAll}
                      className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                    >
                      Clear all
                    </Button>
                  </div>
                </div>

                <ScrollArea className="max-h-96">
                  <div className="space-y-0">
                    {displayNotifications.map((notification, index) => {
                      const SeverityIcon = severityIcons[notification.severity || 'info'];
                      const severityColor = severityColors[notification.severity || 'info'];
                      const isUnread = !notification.read;
                      
                      return (
                        <div key={notification.id}>
                          <div
                            className={cn(
                              'px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors',
                              isUnread && 'bg-blue-50/50 dark:bg-blue-950/20'
                            )}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex items-start space-x-3">
                              <div className={cn('flex-shrink-0 mt-0.5', severityColor)}>
                                <SeverityIcon size={14} />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                  <p className={cn(
                                    'text-sm font-medium truncate',
                                    isUnread && 'font-semibold'
                                  )}>
                                    {notification.title}
                                  </p>
                                  {isUnread && (
                                    <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full ml-2 mt-1.5" />
                                  )}
                                </div>
                                
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {notification.message}
                                </p>
                                
                                <div className="flex items-center justify-between mt-2">
                                  {notification.repository && (
                                    <Badge variant="outline" className="text-xs py-0 px-1">
                                      {notification.repository.split('/')[1]}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {index < displayNotifications.length - 1 && (
                            <Separator className="mx-4" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            )}

            {displayNotifications.length === 0 && (
              <CardContent className="p-8 text-center">
                <Bell size={32} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You'll see real-time updates here when scans complete
                </p>
              </CardContent>
            )}
          </Card>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Simplified notification bell for header/toolbar use
 */
export function NotificationBell({ 
  className,
  ...props 
}: Omit<RealtimeNotificationsProps, 'maxNotifications'> & { className?: string }) {
  return (
    <div className={cn('flex items-center', className)}>
      <RealtimeNotifications maxNotifications={20} {...props} />
    </div>
  );
}