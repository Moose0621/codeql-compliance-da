import { useState, useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, 
  Check, 
  Trash, 
  Shield,
  ArrowClockwise,
  Warning,
  Info,
  FunnelSimple
} from '@phosphor-icons/react';
import { useNotifications } from '@/hooks/useNotifications';
import { notificationService } from '@/lib/notification-service';
import { NotificationItem } from './NotificationItem';
import { NotificationFilters } from './NotificationFilters';
import type { Notification } from '@/types/dashboard';

interface NotificationCenterProps {
  className?: string;
  maxHeight?: string;
  showFilters?: boolean;
}

export function NotificationCenter({ 
  className = '', 
  maxHeight = '400px',
  showFilters = true 
}: NotificationCenterProps) {
  const {
    notifications,
    unreadCount,
    notificationsByType,
    markAllAsRead,
    clearAll,
    hasUnread,
    totalCount
  } = useNotifications();

  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'security' | 'scans'>('all');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [filters, setFilters] = useState({
    severity: [] as string[],
    repository: '',
    dateRange: 7, // days
  });

  // Filter and sort notifications
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Apply tab filter
    switch (activeTab) {
      case 'unread':
        filtered = filtered.filter(n => !n.read);
        break;
      case 'security':
        filtered = filtered.filter(n => n.type === 'security_alert');
        break;
      case 'scans':
        filtered = filtered.filter(n => n.type === 'scan_complete');
        break;
    }

    // Apply additional filters
    if (filters.severity.length > 0) {
      filtered = filtered.filter(n => filters.severity.includes(n.severity));
    }

    if (filters.repository) {
      filtered = filtered.filter(n => 
        n.repository?.toLowerCase().includes(filters.repository.toLowerCase())
      );
    }

    if (filters.dateRange > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - filters.dateRange);
      filtered = filtered.filter(n => new Date(n.timestamp) >= cutoff);
    }

    // Sort by timestamp (newest first)
    return filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [notifications, activeTab, filters]);

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'security':
        return <Shield size={16} />;
      case 'scans':
        return <ArrowClockwise size={16} />;
      case 'unread':
        return <Bell size={16} />;
      default:
        return <Info size={16} />;
    }
  };

  const getTabCount = (tab: string) => {
    switch (tab) {
      case 'unread':
        return unreadCount;
      case 'security':
        return notificationsByType.security_alert.length;
      case 'scans':
        return notificationsByType.scan_complete.length;
      default:
        return totalCount;
    }
  };

  // Test function to create sample notifications (development only)
  const createTestNotifications = async () => {
    // Create a security alert
    await notificationService.createNotification(
      'security_alert',
      'critical',
      'Critical Security Alert: test-repo',
      'Found 5 critical vulnerabilities and 12 high severity issues in latest scan',
      {
        repository: 'test-repo',
        actions: [
          { label: 'View Details', action: 'view_details' },
          { label: 'Export Report', action: 'export_report' }
        ]
      }
    );

    // Create a scan completion notification
    await notificationService.createNotification(
      'scan_complete',
      'info',
      'Scan Complete: another-repo',
      'CodeQL scan completed successfully in 2m 30s',
      {
        repository: 'another-repo',
        actions: [
          { label: 'View Results', action: 'view_details' },
          { label: 'Refresh Data', action: 'refresh_scan' }
        ]
      }
    );

    // Create a compliance warning
    await notificationService.createNotification(
      'compliance_warning',
      'high',
      'Compliance Warning: Outdated Scans',
      '3 repositories have not been scanned in the past 7 days',
      {
        actions: [
          { label: 'Review Repositories', action: 'view_details' }
        ]
      }
    );
  };

  return (
    <Card className={`notification-center ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell size={18} />
            Notifications
            {hasUnread && (
              <Badge variant="destructive" className="ml-1">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={createTestNotifications}
              title="Create test notifications"
            >
              Test
            </Button>
            {showFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                className={showFiltersPanel ? 'bg-muted' : ''}
              >
                <FunnelSimple size={14} />
              </Button>
            )}
            {hasUnread && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                title="Mark all as read"
              >
                <Check size={14} />
              </Button>
            )}
            {totalCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                title="Clear all notifications"
              >
                <Trash size={14} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Filters Panel */}
        {showFiltersPanel && showFilters && (
          <div className="border-b p-4">
            <NotificationFilters
              filters={filters}
              onFiltersChange={setFilters}
              notifications={notifications}
            />
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4 rounded-none border-b">
            <TabsTrigger value="all" className="flex items-center gap-1">
              {getTabIcon('all')}
              All
              <Badge variant="secondary" className="ml-1">
                {getTabCount('all')}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="unread" className="flex items-center gap-1">
              {getTabIcon('unread')}
              Unread
              {getTabCount('unread') > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {getTabCount('unread')}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-1">
              {getTabIcon('security')}
              Security
              <Badge variant="secondary" className="ml-1">
                {getTabCount('security')}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="scans" className="flex items-center gap-1">
              {getTabIcon('scans')}
              Scans
              <Badge variant="secondary" className="ml-1">
                {getTabCount('scans')}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Notification Lists */}
          <TabsContent value={activeTab} className="m-0">
            <ScrollArea style={{ maxHeight }} className="w-full">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bell size={48} className="text-muted-foreground mb-2" />
                  <h3 className="font-medium text-muted-foreground">No notifications</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeTab === 'unread' 
                      ? 'All caught up! No unread notifications.'
                      : activeTab === 'security'
                      ? 'No security alerts at this time.'
                      : activeTab === 'scans'
                      ? 'No scan notifications yet.'
                      : 'No notifications to display.'
                    }
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}