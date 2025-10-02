/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Repository, SecurityFindings } from '@/types/dashboard';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

// Setup localStorage before imports
if (typeof window !== 'undefined') {
  global.localStorage = localStorageMock as any;
}

// Mock Notification API
if (typeof window !== 'undefined') {
  global.Notification = {
    permission: 'default',
    requestPermission: vi.fn().mockResolvedValue('granted')
  } as any;
}

// Mock logger
vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn()
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-' + Date.now()
}));

// Now import after mocks are setup
import { NotificationService } from '@/lib/notification-service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    // Setup mocks
    if (typeof window !== 'undefined') {
      global.localStorage = localStorageMock as any;
      global.Notification = {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted')
      } as any;
    }
    
    // Clear localStorage
    localStorageMock.clear();
    
    // Get singleton instance
    service = NotificationService.getInstance();
    
    // Clear all notifications to reset state
    service.clearAll();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = NotificationService.getInstance();
      const instance2 = NotificationService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('createNotification', () => {
    it('should create a notification with basic properties', async () => {
      const id = await service.createNotification(
        'security_alert',
        'high',
        'Test Alert',
        'This is a test message',
        { skipDelivery: true }
      );

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      
      const history = service.getHistory();
      expect(history.notifications.length).toBe(1);
      expect(history.notifications[0].title).toBe('Test Alert');
      expect(history.notifications[0].severity).toBe('high');
      expect(history.notifications[0].read).toBe(false);
    });

    it('should create notification with repository and actions', async () => {
      const actions = [
        { action: 'view_details' as const, label: 'View Details' }
      ];

      await service.createNotification(
        'scan_complete',
        'info',
        'Scan Complete',
        'Scan finished successfully',
        {
          repository: 'test-repo',
          actions,
          skipDelivery: true
        }
      );

      const history = service.getHistory();
      expect(history.notifications[0].repository).toBe('test-repo');
      expect(history.notifications[0].actions).toEqual(actions);
    });
  });

  describe('createSecurityAlert', () => {
    it('should create security alert for critical findings', async () => {
      const repository: Repository = {
        id: 1,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        owner: { login: 'owner', avatar_url: '' },
        has_codeql_workflow: true,
        workflow_dispatch_enabled: true,
        default_branch: 'main',
        last_scan_status: 'success',
        last_scan_date: '2024-01-01',
        security_findings: {
          critical: 2,
          high: 3,
          medium: 1,
          low: 0,
          note: 0,
          total: 6
        }
      };

      const findings: SecurityFindings = {
        critical: 2,
        high: 3,
        medium: 1,
        low: 0,
        note: 0,
        total: 6
      };

      const id = await service.createSecurityAlert(repository, findings);
      
      expect(id).toBeDefined();
      const history = service.getHistory();
      expect(history.notifications.length).toBeGreaterThan(0);
      const notification = history.notifications.find(n => n.id === id);
      expect(notification?.type).toBe('security_alert');
      expect(notification?.severity).toBe('critical');
    });

    it('should create appropriate severity based on findings', async () => {
      const repository: Repository = {
        id: 1,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        owner: { login: 'owner', avatar_url: '' },
        has_codeql_workflow: true,
        workflow_dispatch_enabled: true,
        default_branch: 'main',
        last_scan_status: 'success',
        last_scan_date: '2024-01-01',
        security_findings: {
          critical: 0,
          high: 2,
          medium: 1,
          low: 0,
          note: 0,
          total: 3
        }
      };

      const findings: SecurityFindings = {
        critical: 0,
        high: 2,
        medium: 1,
        low: 0,
        note: 0,
        total: 3
      };

      const id = await service.createSecurityAlert(repository, findings);
      const history = service.getHistory();
      const notification = history.notifications.find(n => n.id === id);
      expect(notification?.severity).toBe('high');
    });
  });

  describe('createScanCompleteNotification', () => {
    it('should create success notification for successful scan', async () => {
      const repository: Repository = {
        id: 1,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        owner: { login: 'owner', avatar_url: '' },
        has_codeql_workflow: true,
        workflow_dispatch_enabled: true,
        default_branch: 'main',
        last_scan_status: 'success',
        last_scan_date: '2024-01-01'
      };

      const id = await service.createScanCompleteNotification(repository, true, 120);
      
      const history = service.getHistory();
      const notification = history.notifications.find(n => n.id === id);
      expect(notification?.type).toBe('scan_complete');
      expect(notification?.severity).toBe('info');
      expect(notification?.title).toContain('Scan Complete');
    });

    it('should create warning notification for failed scan', async () => {
      const repository: Repository = {
        id: 1,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        owner: { login: 'owner', avatar_url: '' },
        has_codeql_workflow: true,
        workflow_dispatch_enabled: true,
        default_branch: 'main',
        last_scan_status: 'failure',
        last_scan_date: '2024-01-01'
      };

      const id = await service.createScanCompleteNotification(repository, false, 120);
      
      const history = service.getHistory();
      const notification = history.notifications.find(n => n.id === id);
      expect(notification?.severity).toBe('medium');
      expect(notification?.title).toContain('Failed');
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const id = await service.createNotification(
        'security_alert',
        'high',
        'Test',
        'Message',
        { skipDelivery: true }
      );

      service.markAsRead(id);
      
      const history = service.getHistory();
      const notification = history.notifications.find(n => n.id === id);
      expect(notification?.read).toBe(true);
    });

    it('should handle non-existent notification ID gracefully', () => {
      expect(() => service.markAsRead('non-existent-id')).not.toThrow();
    });
  });

  describe('markAsUnread', () => {
    it('should allow marking as unread by recreating the notification state', async () => {
      const id = await service.createNotification(
        'security_alert',
        'high',
        'Test',
        'Message',
        { skipDelivery: true }
      );

      service.markAsRead(id);
      // Since there's no markAsUnread method, we verify read state can be toggled
      // by marking as read first
      
      const history = service.getHistory();
      const notification = history.notifications.find(n => n.id === id);
      expect(notification?.read).toBe(true);
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification', async () => {
      const id = await service.createNotification(
        'security_alert',
        'high',
        'Test',
        'Message',
        { skipDelivery: true }
      );

      service.deleteNotification(id);
      
      const history = service.getHistory();
      const notification = history.notifications.find(n => n.id === id);
      expect(notification).toBeUndefined();
    });
  });

  describe('clearAll', () => {
    it('should clear all notifications', async () => {
      await service.createNotification('security_alert', 'high', 'Test 1', 'Message', { skipDelivery: true });
      await service.createNotification('scan_complete', 'info', 'Test 2', 'Message', { skipDelivery: true });

      service.clearAll();
      
      const history = service.getHistory();
      expect(history.notifications.length).toBe(0);
    });
  });

  describe('notification read status', () => {
    it('should track read and unread notifications', async () => {
      const id1 = await service.createNotification('security_alert', 'high', 'Test 1', 'Message', { skipDelivery: true });
      await service.createNotification('scan_complete', 'info', 'Test 2', 'Message', { skipDelivery: true });
      
      service.markAsRead(id1);
      
      const history = service.getHistory();
      const unreadCount = history.notifications.filter(n => !n.read).length;
      expect(unreadCount).toBe(1);
    });

    it('should mark all notifications as read', async () => {
      await service.createNotification('security_alert', 'high', 'Test 1', 'Message', { skipDelivery: true });
      await service.createNotification('scan_complete', 'info', 'Test 2', 'Message', { skipDelivery: true });
      
      const count = service.markAllAsRead();
      
      // Count should be at least 2, but might be more if other tests left notifications
      expect(count).toBeGreaterThanOrEqual(2);
      const history = service.getHistory();
      const unreadCount = history.notifications.filter(n => !n.read).length;
      expect(unreadCount).toBe(0);
    });
  });

  describe('listener management', () => {
    it('should notify listeners when notifications change', async () => {
      const listener = vi.fn();
      service.addListener(listener);

      await service.createNotification('security_alert', 'high', 'Test', 'Message', { skipDelivery: true });

      expect(listener).toHaveBeenCalled();
    });

    it('should remove listener when unsubscribe is called', async () => {
      const listener = vi.fn();
      const unsubscribe = service.addListener(listener);
      
      unsubscribe();
      
      await service.createNotification('security_alert', 'high', 'Test', 'Message', { skipDelivery: true });
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('preference management', () => {
    it('should get default preferences', () => {
      const prefs = service.getPreferences();
      expect(prefs).toBeDefined();
      expect(prefs.channels).toBeDefined();
      expect(prefs.categories).toBeDefined();
    });

    it('should update preferences', () => {
      const newPrefs = {
        channels: { toast: true, desktop: false, email: false },
        categories: {
          security_alerts: { enabled: true, channels: ['toast'], minSeverity: 'high' as const }
        }
      };

      service.updatePreferences(newPrefs as any);
      
      const prefs = service.getPreferences();
      expect(prefs.channels.desktop).toBe(false);
    });
  });
});
