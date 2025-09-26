// Playwright configuration for e2e testing
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['line']
  ],
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173',

    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Capture video on failure */
    video: 'retain-on-failure',

    /* Global test timeout */
    actionTimeout: 30000,
    navigationTimeout: 60000,

    /* Ignore HTTPS errors for development */
    ignoreHTTPSErrors: true,

    /* Additional context options */
    viewport: { width: 1280, height: 720 },
    colorScheme: 'light',
  },

  /* Configure projects for major browsers */
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/*.spec.ts'],
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: ['**/*.spec.ts'],
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: ['**/*.spec.ts'],
    },

    // Mobile devices
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: ['**/responsive-design.spec.ts', '**/advanced-filtering.spec.ts'],
    },
    
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      testMatch: ['**/responsive-design.spec.ts', '**/advanced-filtering.spec.ts'],
    },

    // Tablet devices
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] },
      testMatch: ['**/responsive-design.spec.ts'],
    },

    // Performance testing (Chromium only for consistency)
    {
      name: 'performance',
      use: { 
        ...devices['Desktop Chrome'],
        // Larger viewport for performance tests
        viewport: { width: 1920, height: 1080 },
      },
      testMatch: ['**/performance-accessibility.spec.ts'],
    },

    // Visual regression testing (consistent environment)
    {
      name: 'visual-chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Fixed viewport for consistent screenshots
        viewport: { width: 1280, height: 720 },
        // Disable animations for stable screenshots
        reducedMotion: 'reduce',
      },
      testMatch: ['**/visual-regression.spec.ts'],
    },

    {
      name: 'visual-firefox',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
        reducedMotion: 'reduce',
      },
      testMatch: ['**/visual-regression.spec.ts'],
    },

    // Accessibility testing with specific configurations
    {
      name: 'accessibility',
      use: { 
        ...devices['Desktop Chrome'],
        // Force high contrast for accessibility tests
        colorScheme: 'dark',
        reducedMotion: 'reduce',
      },
      testMatch: ['**/performance-accessibility.spec.ts'],
    },
  ],

  /* Global test timeout */
  timeout: 90000,

  /* Expect timeout for assertions */
  expect: {
    timeout: 10000,
    // Visual comparison threshold
    threshold: 0.3,
    // Screenshot comparison mode
    mode: 'strict',
  },

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes for build
    stdout: 'pipe',
    stderr: 'pipe',
  },

  /* Test output directories */
  outputDir: 'test-results/',
  
  /* Global setup and teardown */
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
});