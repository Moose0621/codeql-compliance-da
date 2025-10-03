import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Filter Preset Management
 * Handles preset selection, creation, and management
 */
export class PresetManagementPage {
  readonly page: Page;
  readonly presetButtons: Locator;
  readonly savePresetButton: Locator;
  readonly presetNameInput: Locator;
  readonly presetDescriptionInput: Locator;
  readonly deletePresetButton: Locator;
  readonly editPresetButton: Locator;
  readonly exportPresetButton: Locator;
  readonly importPresetButton: Locator;
  readonly presetDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.presetButtons = page.locator('[data-testid="filter-preset"]');
    this.savePresetButton = page.getByRole('button', { name: /Save Preset/ });
    this.presetNameInput = page.getByLabel('Preset Name');
    this.presetDescriptionInput = page.getByLabel('Preset Description');
    this.deletePresetButton = page.getByRole('button', { name: /Delete Preset/ });
    this.editPresetButton = page.getByRole('button', { name: /Edit Preset/ });
    this.exportPresetButton = page.getByRole('button', { name: /Export Preset/ });
    this.importPresetButton = page.getByRole('button', { name: /Import Preset/ });
    this.presetDialog = page.locator('[data-testid="preset-dialog"]');
  }

  /**
   * Apply a specific preset by name
   */
  async applyPreset(presetName: string) {
    await this.presetButtons.filter({ hasText: presetName }).click();
  }

  /**
   * Verify preset exists and is visible
   */
  async verifyPresetExists(presetName: string) {
    await expect(this.presetButtons.filter({ hasText: presetName })).toBeVisible();
  }

  /**
   * Get the count of available presets
   */
  async getPresetCount(): Promise<number> {
    return await this.presetButtons.count();
  }

  /**
   * Save current filter state as a new preset
   */
  async saveAsPreset(name: string, description: string) {
    await this.savePresetButton.click();
    await this.presetNameInput.fill(name);
    await this.presetDescriptionInput.fill(description);
    await this.page.getByRole('button', { name: 'Save' }).click();
  }

  /**
   * Edit an existing preset
   */
  async editPreset(oldName: string, newName: string, newDescription: string) {
    // Right-click on preset to show context menu
    await this.presetButtons.filter({ hasText: oldName }).click({ button: 'right' });
    await this.editPresetButton.click();
    
    await this.presetNameInput.clear();
    await this.presetNameInput.fill(newName);
    await this.presetDescriptionInput.clear();
    await this.presetDescriptionInput.fill(newDescription);
    await this.page.getByRole('button', { name: 'Update' }).click();
  }

  /**
   * Delete a preset
   */
  async deletePreset(presetName: string) {
    // Right-click on preset to show context menu
    await this.presetButtons.filter({ hasText: presetName }).click({ button: 'right' });
    await this.deletePresetButton.click();
    // Confirm deletion
    await this.page.getByRole('button', { name: 'Delete' }).click();
  }

  /**
   * Export preset configuration
   */
  async exportPreset(presetName: string): Promise<string> {
    await this.presetButtons.filter({ hasText: presetName }).click({ button: 'right' });
    await this.exportPresetButton.click();
    
    // Capture the exported configuration from clipboard or modal
    const exportData = await this.page.evaluate(() => {
      return navigator.clipboard.readText();
    });
    
    return exportData;
  }

  /**
   * Import preset from configuration
   */
  async importPreset(presetConfig: string) {
    await this.importPresetButton.click();
    
    // Paste the configuration
    await this.page.evaluate(async (config) => {
      await navigator.clipboard.writeText(config);
    }, presetConfig);
    
    await this.page.keyboard.press('Control+V');
    await this.page.getByRole('button', { name: 'Import' }).click();
  }

  /**
   * Verify default presets are available
   */
  async verifyDefaultPresets() {
    const defaultPresets = [
      'Compliance Ready',
      'Needs Attention', 
      'High Risk Repositories',
      'Recently Active',
      'No Findings'
    ];

    for (const presetName of defaultPresets) {
      await this.verifyPresetExists(presetName);
    }
  }

  /**
   * Verify preset shows correct preview badges
   */
  async verifyPresetPreview(presetName: string, expectedBadges: string[]) {
    const presetButton = this.presetButtons.filter({ hasText: presetName });
    
    for (const badge of expectedBadges) {
      await expect(presetButton.locator('.badge', { hasText: badge })).toBeVisible();
    }
  }

  /**
   * Apply preset and verify filters are correctly set
   */
  async applyAndVerifyPreset(presetName: string, expectedFilters: Record<string, any>) {
    await this.applyPreset(presetName);
    
    // Verify URL parameters or active filter indicators
    const currentUrl = this.page.url();
    
    for (const [filterType, value] of Object.entries(expectedFilters)) {
      if (typeof value === 'string') {
        expect(currentUrl).toContain(`${filterType}=${value}`);
      }
    }
  }
}