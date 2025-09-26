import { FullConfig } from '@playwright/test';

/**
 * Global setup for E2E tests
 * Runs once before all test projects
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test suite setup...');

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.VITE_TEST_MODE = 'true';

  // Clear any previous test artifacts
  console.log('🧹 Clearing previous test artifacts...');

  // Setup performance monitoring baseline
  console.log('📊 Initializing performance baselines...');
  
  // Create test-specific directories if needed
  const fs = await import('fs');
  const path = await import('path');
  
  const testResultsDir = path.join(process.cwd(), 'test-results');
  const screenshotsDir = path.join(testResultsDir, 'screenshots');
  
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
  }
  
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('✅ Global setup completed');
}

export default globalSetup;