import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Check, 
  X, 
  Eye, 
  FileArrowDown,
  ArrowClockwise,
  Shield,
  Warning,
  Info,
  Clock
} from '@phosphor-icons/react';
import { useNotifications } from '@/hooks/useNotifications';
import type { Notification, NotificationAction } from '@/types/dashboard';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface NotificationItemProps {
  notification: Notification;
  compact?: boolean;
  showActions?: boolean;
  onActionClick?: (action: NotificationAction, notification: Notification) => void;
}

export function NotificationItem({ 
  notification, 
  compact = false, 
  showActions = true,
  onActionClick 
}: NotificationItemProps) {
  const { markAsRead, deleteNotification } = useNotifications();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleMarkAsRead = () => {
    markAsRead(notification.id);
  };

  const handleDelete = () => {
    deleteNotification(notification.id);
  };

  const handleActionClick = async (action: NotificationAction) => {
    if (onActionClick) {
      setIsProcessing(true);
      try {
        await onActionClick(action, notification);
      } finally {
        setIsProcessing(false);
      }
    }

    // Auto-mark as read when action is taken
    if (!notification.read) {
      markAsRead(notification.id);
    }
  };

  const getSeverityIcon = () => {
    switch (notification.severity) {
      case 'critical':
        return <Shield size={16} className="text-red-600" />;
      case 'high':
        return <Warning size={16} className="text-orange-500" />;
      case 'medium':
        return <Info size={16} className="text-yellow-500" />;
      case 'low':
        return <Info size={16} className="text-blue-500" />;
      default:
        return <Info size={16} className="text-gray-500" />;
    }
  };

  const getTypeIcon = () => {
    switch (notification.type) {
      case 'security_alert':
        return <Shield size={16} className="text-red-600" />;
      case 'scan_complete':
        return <ArrowClockwise size={16} className="text-green-600" />;
      case 'compliance_warning':
        return <Warning size={16} className="text-yellow-600" />;
      case 'system_update':
        return <Info size={16} className="text-blue-600" />;
      default:
        return <Info size={16} className="text-gray-600" />;
    }
  };

  const getSeverityBadgeVariant = () => {
    switch (notification.severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getActionIcon = (action: NotificationAction) => {
    switch (action.action) {
      case 'view_details':
        return <Eye size={14} />;
      case 'export_report':
        return <FileArrowDown size={14} />;
      case 'refresh_scan':
        return <ArrowClockwise size={14} />;
      case 'dismiss':
        return <X size={14} />;
      case 'mark_read':
        return <Check size={14} />;
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  return (
    <div
      className={cn(
        'notification-item p-4 hover:bg-muted/50 transition-colors',
        !notification.read && 'bg-accent/5 border-l-2 border-l-accent',
        compact && 'p-2'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Type/Severity Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {getSeverityIcon()}
        </div>

        {/* Content */}
        <div className="flex-grow min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-grow min-w-0">
              {/* Title and badges */}
              <div className="flex items-center gap-2 mb-1">
                <h4 className={cn(
                  'font-medium truncate',
                  !notification.read && 'font-semibold',
                  compact ? 'text-sm' : 'text-base'
                )}>
                  {notification.title}
                </h4>
                <Badge variant={getSeverityBadgeVariant()} className="text-xs">
                  {notification.severity}
                </Badge>
                {!notification.read && (
                  <div className="w-2 h-2 bg-accent rounded-full flex-shrink-0" />
                )}
              </div>

              {/* Message */}
              <p className={cn(
                'text-muted-foreground mb-2',
                compact ? 'text-xs' : 'text-sm'
              )}>
                {notification.message}
              </p>

              {/* Repository and timestamp */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {notification.repository && (
                  <>
                    <span className="font-mono">{notification.repository}</span>
                    <span>•</span>
                  </>
                )}
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  {formatTimestamp(notification.timestamp)}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {!notification.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAsRead}
                  title="Mark as read"
                  className="h-6 w-6 p-0"
                >
                  <Check size={12} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                title="Delete notification"
                className="h-6 w-6 p-0"
              >
                <X size={12} />
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          {showActions && notification.actions && notification.actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {notification.actions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleActionClick(action)}
                  disabled={isProcessing}
                  className="h-7 text-xs"
                >
                  {getActionIcon(action)}
                  <span className="ml-1">{action.label}</span>
                </Button>
              ))}
            </div>
          )}

          {/* Metadata (for debugging, can be hidden in production) */}
          {notification.metadata && process.env.NODE_ENV === 'development' && (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                Debug Info
              </summary>
              <pre className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded overflow-auto">
                {JSON.stringify(notification.metadata, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}