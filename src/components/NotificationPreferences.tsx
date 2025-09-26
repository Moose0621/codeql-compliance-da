import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bell, 
  Desktop, 
  Envelope, 
  Shield, 
  ArrowClockwise, 
  Warning, 
  Info,
  Clock,
  TestTube
} from '@phosphor-icons/react';
import { useNotificationPreferences } from '@/hooks/useNotifications';
import { toast } from 'sonner';
import { notificationService } from '@/lib/notification-service';

interface NotificationPreferencesProps {
  className?: string;
}

export function NotificationPreferences({ className = '' }: NotificationPreferencesProps) {
  const {
    preferences,
    toggleChannel,
    toggleCategory,
    updateCategoryChannels,
    updateMinSeverity,
    updateQuietHours,
    updateEmailSettings,
    enableDesktopNotifications,
    canUseDesktop,
    desktopEnabled,
    emailConfigured,
    isLoading
  } = useNotificationPreferences();

  const [emailAddress, setEmailAddress] = useState(preferences.email.address || '');
  const [quietHoursStart, setQuietHoursStart] = useState(preferences.quietHours.startTime);
  const [quietHoursEnd, setQuietHoursEnd] = useState(preferences.quietHours.endTime);

  const handleEmailSave = () => {
    if (emailAddress && !isValidEmail(emailAddress)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    updateEmailSettings({
      address: emailAddress,
      enabled: !!emailAddress
    });
    
    if (emailAddress) {
      toast.success('Email address saved');
    } else {
      toast.info('Email notifications disabled');
    }
  };

  const handleDesktopEnable = async () => {
    const granted = await enableDesktopNotifications();
    if (granted) {
      toast.success('Desktop notifications enabled');
    } else {
      toast.error('Desktop notification permission denied');
    }
  };

  const handleQuietHoursSave = () => {
    if (!isValidTime(quietHoursStart) || !isValidTime(quietHoursEnd)) {
      toast.error('Please enter valid times (HH:MM format)');
      return;
    }
    
    updateQuietHours({
      startTime: quietHoursStart,
      endTime: quietHoursEnd
    });
    
    toast.success('Quiet hours updated');
  };

  const handleTestNotification = async () => {
    try {
      await notificationService.createNotification(
        'system_update',
        'info',
        'Test Notification',
        'This is a test notification to verify your settings are working correctly.',
        { skipDelivery: false }
      );
      toast.success('Test notification sent');
    } catch (error) {
      toast.error('Failed to send test notification');
    }
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isValidTime = (time: string): boolean => {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
  };

  const severityOptions = [
    { value: 'info', label: 'Info' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' }
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell size={18} />
          Notification Preferences
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Global Channel Settings */}
        <div className="space-y-4">
          <h3 className="font-medium flex items-center gap-2">
            <Bell size={16} />
            Notification Channels
          </h3>
          
          {/* Toast Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="font-medium">Toast Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show notifications in the bottom corner
              </p>
            </div>
            <Switch
              checked={preferences.channels.toast}
              onCheckedChange={() => toggleChannel('toast')}
            />
          </div>

          {/* Desktop Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="font-medium flex items-center gap-2">
                <Desktop size={14} />
                Desktop Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Show system notifications even when tab is not active
              </p>
              {!canUseDesktop && (
                <p className="text-xs text-destructive">
                  Not supported in this browser
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canUseDesktop && !preferences.desktop.permissionGranted && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDesktopEnable}
                  disabled={isLoading}
                >
                  Enable
                </Button>
              )}
              <Switch
                checked={desktopEnabled}
                onCheckedChange={() => toggleChannel('desktop')}
                disabled={!canUseDesktop || !preferences.desktop.permissionGranted}
              />
            </div>
          </div>

          {/* Email Notifications */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="font-medium flex items-center gap-2">
                  <Envelope size={14} />
                  Email Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Send notifications to your email address
                </p>
              </div>
              <Switch
                checked={preferences.channels.email}
                onCheckedChange={() => toggleChannel('email')}
                disabled={!emailConfigured}
              />
            </div>
            
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter email address"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleEmailSave}
                disabled={isLoading}
                size="sm"
              >
                Save
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Category Settings */}
        <div className="space-y-4">
          <h3 className="font-medium">Notification Categories</h3>

          {/* Security Alerts */}
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-red-600" />
                <Label className="font-medium">Security Alerts</Label>
              </div>
              <Switch
                checked={preferences.categories.security_alert.enabled}
                onCheckedChange={(checked) => toggleCategory('security_alert', checked)}
              />
            </div>
            
            {preferences.categories.security_alert.enabled && (
              <div className="space-y-2 ml-6">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Minimum severity:</Label>
                  <Select
                    value={preferences.categories.security_alert.minSeverity}
                    onValueChange={(value) => updateMinSeverity('security_alert', value as any)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {severityOptions.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2 text-sm">
                  <span>Channels:</span>
                  {preferences.categories.security_alert.channels.map((channel) => (
                    <span key={channel} className="px-2 py-1 bg-muted rounded text-xs">
                      {channel}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Scan Complete */}
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowClockwise size={16} className="text-green-600" />
                <Label className="font-medium">Scan Completion</Label>
              </div>
              <Switch
                checked={preferences.categories.scan_complete.enabled}
                onCheckedChange={(checked) => toggleCategory('scan_complete', checked)}
              />
            </div>
            
            {preferences.categories.scan_complete.enabled && (
              <div className="ml-6">
                <div className="flex gap-2 text-sm">
                  <span>Channels:</span>
                  {preferences.categories.scan_complete.channels.map((channel) => (
                    <span key={channel} className="px-2 py-1 bg-muted rounded text-xs">
                      {channel}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Compliance Warnings */}
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Warning size={16} className="text-yellow-600" />
                <Label className="font-medium">Compliance Warnings</Label>
              </div>
              <Switch
                checked={preferences.categories.compliance_warning.enabled}
                onCheckedChange={(checked) => toggleCategory('compliance_warning', checked)}
              />
            </div>
            
            {preferences.categories.compliance_warning.enabled && (
              <div className="space-y-2 ml-6">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Minimum severity:</Label>
                  <Select
                    value={preferences.categories.compliance_warning.minSeverity}
                    onValueChange={(value) => updateMinSeverity('compliance_warning', value as any)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {severityOptions.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2 text-sm">
                  <span>Channels:</span>
                  {preferences.categories.compliance_warning.channels.map((channel) => (
                    <span key={channel} className="px-2 py-1 bg-muted rounded text-xs">
                      {channel}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* System Updates */}
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-blue-600" />
                <Label className="font-medium">System Updates</Label>
              </div>
              <Switch
                checked={preferences.categories.system_update.enabled}
                onCheckedChange={(checked) => toggleCategory('system_update', checked)}
              />
            </div>
            
            {preferences.categories.system_update.enabled && (
              <div className="ml-6">
                <div className="flex gap-2 text-sm">
                  <span>Channels:</span>
                  {preferences.categories.system_update.channels.map((channel) => (
                    <span key={channel} className="px-2 py-1 bg-muted rounded text-xs">
                      {channel}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Quiet Hours */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="font-medium flex items-center gap-2">
                <Clock size={16} />
                Quiet Hours
              </Label>
              <p className="text-sm text-muted-foreground">
                Suppress notifications during specified hours
              </p>
            </div>
            <Switch
              checked={preferences.quietHours.enabled}
              onCheckedChange={(enabled) => updateQuietHours({ enabled })}
            />
          </div>

          {preferences.quietHours.enabled && (
            <div className="space-y-3 ml-6">
              <div className="flex gap-4 items-center">
                <div className="space-y-1">
                  <Label className="text-sm">Start time</Label>
                  <Input
                    type="time"
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(e.target.value)}
                    className="w-32"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">End time</Label>
                  <Input
                    type="time"
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(e.target.value)}
                    className="w-32"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleQuietHoursSave}
                  disabled={isLoading}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Test Section */}
        <div className="space-y-3">
          <Label className="font-medium">Test Notifications</Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTestNotification}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <TestTube size={16} />
              Send Test Notification
            </Button>
          </div>
          <Alert>
            <Info size={16} />
            <AlertDescription>
              Use the test button to verify your notification settings are working correctly.
              The test notification will use your current preferences.
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
}