// Page Object Model for Notification Preferences UI
import { type Page, type Locator, expect } from '@playwright/test';
import type { NotificationPreferences, NotificationChannel } from '@/types/notifications';

export class NotificationPreferencesPage {
  readonly page: Page;
  
  // Main navigation and containers
  readonly notificationTab: Locator;
  readonly preferencesContainer: Locator;
  readonly saveButton: Locator;
  readonly resetButton: Locator;
  
  // Channel toggles
  readonly emailToggle: Locator;
  readonly slackToggle: Locator;
  readonly teamsToggle: Locator;
  readonly inAppToggle: Locator;
  readonly mobileToggle: Locator;
  
  // Email configuration
  readonly emailAddressInput: Locator;
  readonly emailFormatSelect: Locator;
  readonly addEmailButton: Locator;
  
  // Slack configuration
  readonly slackWebhookInput: Locator;
  readonly slackChannelInput: Locator;
  readonly slackUsernameInput: Locator;
  readonly testSlackButton: Locator;
  
  // Teams configuration
  readonly teamsWebhookInput: Locator;
  readonly teamsChannelInput: Locator;
  readonly testTeamsButton: Locator;
  
  // Frequency settings
  readonly immediateRadio: Locator;
  readonly batchedRadio: Locator;
  readonly digestOnlyRadio: Locator;
  
  // Content filters
  readonly securityAlertsCheckbox: Locator;
  readonly complianceViolationsCheckbox: Locator;
  readonly workflowFailuresCheckbox: Locator;
  readonly repositoryChangesCheckbox: Locator;
  
  // Severity filters
  readonly criticalSeverityCheckbox: Locator;
  readonly highSeverityCheckbox: Locator;
  readonly mediumSeverityCheckbox: Locator;
  readonly lowSeverityCheckbox: Locator;
  
  // Quiet hours
  readonly quietHoursToggle: Locator;
  readonly quietHoursStartInput: Locator;
  readonly quietHoursEndInput: Locator;
  readonly timezoneSelect: Locator;
  
  // Emergency override
  readonly emergencyOverrideToggle: Locator;
  
  // Digest settings
  readonly digestEnabledToggle: Locator;
  readonly digestFrequencySelect: Locator;
  readonly digestTimeInput: Locator;
  readonly digestTimezoneSelect: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Main navigation and containers
    this.notificationTab = page.getByRole('tab', { name: 'Notifications' });
    this.preferencesContainer = page.getByTestId('notification-preferences');
    this.saveButton = page.getByRole('button', { name: 'Save Preferences' });
    this.resetButton = page.getByRole('button', { name: 'Reset to Defaults' });
    
    // Channel toggles
    this.emailToggle = page.getByTestId('email-toggle');
    this.slackToggle = page.getByTestId('slack-toggle');
    this.teamsToggle = page.getByTestId('teams-toggle');
    this.inAppToggle = page.getByTestId('in-app-toggle');
    this.mobileToggle = page.getByTestId('mobile-toggle');
    
    // Email configuration
    this.emailAddressInput = page.getByLabel('Email Address');
    this.emailFormatSelect = page.getByLabel('Email Format');
    this.addEmailButton = page.getByRole('button', { name: 'Add Email' });
    
    // Slack configuration
    this.slackWebhookInput = page.getByLabel('Slack Webhook URL');
    this.slackChannelInput = page.getByLabel('Slack Channel');
    this.slackUsernameInput = page.getByLabel('Bot Username');
    this.testSlackButton = page.getByRole('button', { name: 'Test Slack Connection' });
    
    // Teams configuration
    this.teamsWebhookInput = page.getByLabel('Teams Webhook URL');
    this.teamsChannelInput = page.getByLabel('Teams Channel');
    this.testTeamsButton = page.getByRole('button', { name: 'Test Teams Connection' });
    
    // Frequency settings
    this.immediateRadio = page.getByLabel('Immediate');
    this.batchedRadio = page.getByLabel('Batched');
    this.digestOnlyRadio = page.getByLabel('Digest Only');
    
    // Content filters
    this.securityAlertsCheckbox = page.getByLabel('Security Alerts');
    this.complianceViolationsCheckbox = page.getByLabel('Compliance Violations');
    this.workflowFailuresCheckbox = page.getByLabel('Workflow Failures');
    this.repositoryChangesCheckbox = page.getByLabel('Repository Changes');
    
    // Severity filters
    this.criticalSeverityCheckbox = page.getByLabel('Critical');
    this.highSeverityCheckbox = page.getByLabel('High');
    this.mediumSeverityCheckbox = page.getByLabel('Medium');
    this.lowSeverityCheckbox = page.getByLabel('Low');
    
    // Quiet hours
    this.quietHoursToggle = page.getByTestId('quiet-hours-toggle');
    this.quietHoursStartInput = page.getByLabel('Start Time');
    this.quietHoursEndInput = page.getByLabel('End Time');
    this.timezoneSelect = page.getByLabel('Timezone');
    
    // Emergency override
    this.emergencyOverrideToggle = page.getByTestId('emergency-override-toggle');
    
    // Digest settings
    this.digestEnabledToggle = page.getByTestId('digest-enabled-toggle');
    this.digestFrequencySelect = page.getByLabel('Digest Frequency');
    this.digestTimeInput = page.getByLabel('Digest Time');
    this.digestTimezoneSelect = page.getByLabel('Digest Timezone');
  }

  async navigateToNotificationPreferences(): Promise<void> {
    await this.notificationTab.click();
    await expect(this.preferencesContainer).toBeVisible();
  }

  async enableChannel(channel: 'email' | 'slack' | 'teams' | 'in-app' | 'mobile'): Promise<void> {
    const toggle = this.getChannelToggle(channel);
    
    if (!(await toggle.isChecked())) {
      await toggle.click();
    }
    
    await expect(toggle).toBeChecked();
  }

  async disableChannel(channel: 'email' | 'slack' | 'teams' | 'in-app' | 'mobile'): Promise<void> {
    const toggle = this.getChannelToggle(channel);
    
    if (await toggle.isChecked()) {
      await toggle.click();
    }
    
    await expect(toggle).not.toBeChecked();
  }

  async configureEmailChannel(addresses: string[], format: 'html' | 'text' | 'both' = 'both'): Promise<void> {
    await this.enableChannel('email');
    
    // Clear existing addresses first
    const existingEmails = this.page.locator('[data-testid="email-address-item"]');
    const count = await existingEmails.count();
    for (let i = 0; i < count; i++) {
      await existingEmails.first().getByRole('button', { name: 'Remove' }).click();
    }
    
    // Add new addresses
    for (const address of addresses) {
      await this.emailAddressInput.fill(address);
      await this.addEmailButton.click();
      await expect(this.page.getByText(address)).toBeVisible();
    }
    
    // Set format
    await this.emailFormatSelect.selectOption(format);
  }

  async configureSlackChannel(webhookUrl: string, channel: string, username?: string): Promise<void> {
    await this.enableChannel('slack');
    
    await this.slackWebhookInput.fill(webhookUrl);
    await this.slackChannelInput.fill(channel);
    
    if (username) {
      await this.slackUsernameInput.fill(username);
    }
  }

  async configureTeamsChannel(webhookUrl: string, channel: string): Promise<void> {
    await this.enableChannel('teams');
    
    await this.teamsWebhookInput.fill(webhookUrl);
    await this.teamsChannelInput.fill(channel);
  }

  async testChannelConnection(channel: 'slack' | 'teams'): Promise<void> {
    const testButton = channel === 'slack' ? this.testSlackButton : this.testTeamsButton;
    
    await testButton.click();
    
    // Wait for test result
    await expect(this.page.getByText('Connection test successful')).toBeVisible({ timeout: 10000 });
  }

  async setNotificationFrequency(frequency: 'immediate' | 'batched' | 'digest_only'): Promise<void> {
    switch (frequency) {
      case 'immediate':
        await this.immediateRadio.click();
        break;
      case 'batched':
        await this.batchedRadio.click();
        break;
      case 'digest_only':
        await this.digestOnlyRadio.click();
        break;
    }
    
    await expect(this.getFrequencyRadio(frequency)).toBeChecked();
  }

  async configureContentFilters(
    types: string[],
    severities: string[]
  ): Promise<void> {
    // First uncheck all
    const allTypeCheckboxes = [
      this.securityAlertsCheckbox,
      this.complianceViolationsCheckbox,
      this.workflowFailuresCheckbox,
      this.repositoryChangesCheckbox
    ];
    
    for (const checkbox of allTypeCheckboxes) {
      if (await checkbox.isChecked()) {
        await checkbox.click();
      }
    }
    
    const allSeverityCheckboxes = [
      this.criticalSeverityCheckbox,
      this.highSeverityCheckbox,
      this.mediumSeverityCheckbox,
      this.lowSeverityCheckbox
    ];
    
    for (const checkbox of allSeverityCheckboxes) {
      if (await checkbox.isChecked()) {
        await checkbox.click();
      }
    }
    
    // Check selected types
    for (const type of types) {
      await this.getContentTypeCheckbox(type).click();
    }
    
    // Check selected severities
    for (const severity of severities) {
      await this.getSeverityCheckbox(severity).click();
    }
  }

  async configureQuietHours(
    enabled: boolean,
    startTime?: string,
    endTime?: string,
    timezone?: string
  ): Promise<void> {
    if (enabled) {
      if (!(await this.quietHoursToggle.isChecked())) {
        await this.quietHoursToggle.click();
      }
      
      if (startTime) {
        await this.quietHoursStartInput.fill(startTime);
      }
      
      if (endTime) {
        await this.quietHoursEndInput.fill(endTime);
      }
      
      if (timezone) {
        await this.timezoneSelect.selectOption(timezone);
      }
    } else {
      if (await this.quietHoursToggle.isChecked()) {
        await this.quietHoursToggle.click();
      }
    }
    
    await expect(this.quietHoursToggle).toHaveAttribute('aria-checked', enabled.toString());
  }

  async enableEmergencyOverride(enabled: boolean = true): Promise<void> {
    if (enabled !== await this.emergencyOverrideToggle.isChecked()) {
      await this.emergencyOverrideToggle.click();
    }
    
    await expect(this.emergencyOverrideToggle).toHaveAttribute('aria-checked', enabled.toString());
  }

  async configureDigestSettings(
    enabled: boolean,
    frequency?: 'daily' | 'weekly',
    time?: string,
    timezone?: string
  ): Promise<void> {
    if (enabled) {
      if (!(await this.digestEnabledToggle.isChecked())) {
        await this.digestEnabledToggle.click();
      }
      
      if (frequency) {
        await this.digestFrequencySelect.selectOption(frequency);
      }
      
      if (time) {
        await this.digestTimeInput.fill(time);
      }
      
      if (timezone) {
        await this.digestTimezoneSelect.selectOption(timezone);
      }
    } else {
      if (await this.digestEnabledToggle.isChecked()) {
        await this.digestEnabledToggle.click();
      }
    }
    
    await expect(this.digestEnabledToggle).toHaveAttribute('aria-checked', enabled.toString());
  }

  async savePreferences(): Promise<void> {
    await this.saveButton.click();
    await expect(this.page.getByText('Preferences saved successfully')).toBeVisible();
  }

  async resetToDefaults(): Promise<void> {
    await this.resetButton.click();
    
    // Confirm reset in dialog
    await this.page.getByRole('button', { name: 'Reset' }).click();
    await expect(this.page.getByText('Preferences reset to defaults')).toBeVisible();
  }

  async previewNotification(): Promise<void> {
    const previewButton = this.page.getByRole('button', { name: 'Preview Notification' });
    await previewButton.click();
    
    await expect(this.page.getByTestId('notification-preview')).toBeVisible();
  }

  // Helper methods
  private getChannelToggle(channel: string): Locator {
    switch (channel) {
      case 'email': return this.emailToggle;
      case 'slack': return this.slackToggle;
      case 'teams': return this.teamsToggle;
      case 'in-app': return this.inAppToggle;
      case 'mobile': return this.mobileToggle;
      default: throw new Error(`Unknown channel: ${channel}`);
    }
  }

  private getFrequencyRadio(frequency: string): Locator {
    switch (frequency) {
      case 'immediate': return this.immediateRadio;
      case 'batched': return this.batchedRadio;
      case 'digest_only': return this.digestOnlyRadio;
      default: throw new Error(`Unknown frequency: ${frequency}`);
    }
  }

  private getContentTypeCheckbox(type: string): Locator {
    switch (type) {
      case 'security_alerts': return this.securityAlertsCheckbox;
      case 'compliance_violations': return this.complianceViolationsCheckbox;
      case 'workflow_failures': return this.workflowFailuresCheckbox;
      case 'repository_status_change': return this.repositoryChangesCheckbox;
      default: throw new Error(`Unknown content type: ${type}`);
    }
  }

  private getSeverityCheckbox(severity: string): Locator {
    switch (severity) {
      case 'critical': return this.criticalSeverityCheckbox;
      case 'high': return this.highSeverityCheckbox;
      case 'medium': return this.mediumSeverityCheckbox;
      case 'low': return this.lowSeverityCheckbox;
      default: throw new Error(`Unknown severity: ${severity}`);
    }
  }
}