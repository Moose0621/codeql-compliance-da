# Enhanced Notification System E2E Tests

This document provides comprehensive documentation for the E2E test suite that validates the multi-channel notification system for the CodeQL Compliance Dashboard.

## Overview

The Enhanced Notification System E2E Tests validate:
- **Multi-channel notification delivery** (Email, Slack, Teams, In-app)
- **User preference management** with real-time configuration
- **Escalation workflows** for critical security alerts  
- **Digest functionality** for batched notifications
- **User experience** across desktop and mobile devices
- **Integration reliability** with external services
- **Performance** under high-volume scenarios

## Test Architecture

### Core Components

```
tests/e2e/
├── notifications.spec.ts              # Main E2E test suite
├── mocks/
│   ├── mock-email-service.ts         # Email delivery simulation
│   ├── mock-slack-service.ts         # Slack API simulation  
│   ├── mock-teams-service.ts         # Teams webhook simulation
│   └── notification-test-suite.ts    # Test orchestration class
├── pages/
│   ├── notification-preferences-page.ts   # Preferences UI page object
│   └── notification-center-page.ts        # In-app notifications page object
└── fixtures/
    └── notification-test-data.ts          # Test data factories
```

### Mock Services

The test suite includes comprehensive mock services that simulate external integrations:

#### Email Service Mock (`MockEmailService`)
- Simulates SMTP delivery with HTML/text formats
- Configurable failure rates and delivery delays
- Tracks delivery history and success/failure metrics
- Generates realistic email content with proper formatting

#### Slack Service Mock (`MockSlackService`)
- Full Slack webhook API simulation
- Rich attachment and formatting support
- Rate limiting simulation
- Channel-specific delivery tracking

#### Teams Service Mock (`MockTeamsService`)
- Microsoft Teams webhook simulation
- Adaptive Card content generation
- Webhook failure simulation
- Action button and formatting support

## Test Categories

### 1. Functional Tests (Critical Priority)

#### Notification Generation and Triggering
```typescript
test('should trigger security alert notifications with correct content')
test('should trigger compliance violation alerts with policy details')
test('should trigger workflow failure notifications with context')
test('should trigger repository status change notifications')
```

**Coverage:**
- ✅ Security alerts with severity levels (critical, high, medium, low)
- ✅ Compliance violations with FedRAMP policy context
- ✅ Workflow failures with detailed error information
- ✅ Repository status changes (archived, visibility, permissions)
- ✅ Scheduled digest notifications

#### Multi-Channel Delivery Validation
```typescript
test('should deliver notifications to all enabled channels')
test('should handle email delivery with HTML and text formats')
test('should format Slack notifications with rich attachments')
test('should create Microsoft Teams adaptive cards')
```

**Coverage:**
- ✅ Email notifications (HTML + text dual format)
- ✅ Slack integration with rich attachments and emojis
- ✅ Microsoft Teams with adaptive card formatting
- ✅ In-app notifications with toast and notification center
- ✅ Content validation across all channels

### 2. User Experience Tests (High Priority)

#### Notification Configuration Interface
```typescript
test('should allow users to configure notification preferences')
test('should provide real-time notification preview')
test('should support bulk configuration across repositories')
```

**Features Tested:**
- ✅ Channel enable/disable toggles
- ✅ Email address management with validation
- ✅ Slack/Teams webhook configuration
- ✅ Real-time preview of notification appearance
- ✅ Bulk preference application
- ✅ Import/export of preferences (UI validation)

#### In-App Notification Center
```typescript
test('should display notifications in the notification center')
test('should support notification filtering and search')
test('should handle notification interactions (mark as read, clear)')
```

**Features Tested:**
- ✅ Notification badge with unread count
- ✅ Filtering by type and severity
- ✅ Search functionality across notifications
- ✅ Mark as read/unread individual and bulk operations
- ✅ Clear notifications with confirmation

### 3. Integration Tests (High Priority)

#### External Service Integration
```typescript
test('should handle email service failures gracefully')
test('should respect Slack rate limiting')
test('should handle Teams webhook failures with retry')
```

**Scenarios Covered:**
- ✅ Service outages and failure handling
- ✅ Rate limiting compliance (especially Slack)
- ✅ Authentication token management and refresh
- ✅ Network timeout handling
- ✅ Graceful degradation when services are unavailable

### 4. Reliability and Performance Tests

#### High-Volume Processing
```typescript
test('should handle high-volume notification processing')
test('should prevent duplicate notifications for same event')
```

**Performance Benchmarks:**
- ✅ 50+ notifications processed in <30 seconds
- ✅ Memory usage remains stable during high volume
- ✅ Deduplication prevents duplicate deliveries
- ✅ Queue management for concurrent processing

#### Escalation Workflows
```typescript
test('should escalate critical alerts after time threshold')
```

**Escalation Testing:**
- ✅ Time-based escalation triggers
- ✅ Multi-level escalation paths
- ✅ Emergency override during quiet hours
- ✅ Escalation channel configuration

### 5. User Preference Management

#### Preference Validation
```typescript
test('should respect quiet hours configuration')
test('should allow emergency override during quiet hours')
test('should filter notifications by severity and type')
```

**Preference Features:**
- ✅ Quiet hours with timezone support
- ✅ Emergency override for critical alerts
- ✅ Content filtering by type and severity
- ✅ Frequency control (immediate, batched, digest)
- ✅ Channel-specific preferences

## Running the Tests

### Prerequisites
```bash
npm install
npx playwright install chromium firefox webkit
```

### Full Test Suite
```bash
# Run all notification E2E tests
npm run test:e2e -- tests/e2e/notifications.spec.ts

# Run with UI for debugging
npm run test:e2e:ui -- tests/e2e/notifications.spec.ts

# Run in headed mode to see browser actions
npm run test:e2e:headed -- tests/e2e/notifications.spec.ts
```

### Specific Test Categories
```bash
# Run only functional tests
npm run test:e2e -- tests/e2e/notifications.spec.ts -g "Notification Generation and Triggering"

# Run only user experience tests  
npm run test:e2e -- tests/e2e/notifications.spec.ts -g "Notification Configuration Interface"

# Run only performance tests
npm run test:e2e -- tests/e2e/notifications.spec.ts -g "Reliability and Performance"
```

### Cross-Browser Testing
```bash
# Run on all browsers (Chromium, Firefox, Safari)
npm run test:e2e -- tests/e2e/notifications.spec.ts --project=chromium --project=firefox --project=webkit

# Mobile device testing
npm run test:e2e -- tests/e2e/notifications.spec.ts --project="Mobile Chrome" --project="Mobile Safari"
```

## Test Data Management

The test suite includes comprehensive test data factories in `notification-test-data.ts`:

### Notification Event Factories
```typescript
// Security alerts with configurable severity
NotificationTestDataManager.createSecurityAlert('critical', 'org/repo')

// Compliance violations with policy details
NotificationTestDataManager.createComplianceViolation('org/repo', 'FedRAMP Policy')

// Workflow failures with technical context  
NotificationTestDataManager.createWorkflowFailure('org/repo', 'CodeQL Analysis')

// Repository status changes
NotificationTestDataManager.createRepositoryStatusChange('org/repo', 'archived')

// Digest notifications with summary data
NotificationTestDataManager.createDigestNotification(['repo1', 'repo2'], '24h')
```

### Preference Configuration Factories
```typescript
// Default comprehensive preferences
NotificationTestDataManager.createDefaultPreferences('user-id')

// Restrictive preferences (critical only)
NotificationTestDataManager.createRestrictivePreferences('user-id')  

// Batched notification preferences
NotificationTestDataManager.createBatchedPreferences('user-id')
```

### Performance Test Data
```typescript
// High-volume event batches for performance testing
const events = NotificationTestDataManager.createHighVolumeEventBatch(100)

// Large notification events for stress testing
const largeEvent = NotificationTestDataManager.createLargeNotificationEvent()
```

## Mock Service Configuration

### Configuring Failure Rates
```typescript
// Configure services with specific failure rates for resilience testing
const notificationSuite = new NotificationTestSuite(page, {
  emailFailureRate: 0.1,      // 10% email delivery failures
  slackFailureRate: 0.05,     // 5% Slack delivery failures  
  teamsFailureRate: 0.15,     // 15% Teams webhook failures
  deliveryDelay: 200          // 200ms artificial delivery delay
})
```

### Service-Specific Testing
```typescript
// Test Slack rate limiting
const slackService = notificationSuite.getSlackService()
slackService.simulateRateLimiting(1000) // 1 second delays

// Configure email bounces
const emailService = notificationSuite.getEmailService()
// Service automatically tracks bounces and delivery failures
```

## Assertion Helpers

### Multi-Channel Delivery Verification
```typescript
// Verify notification delivered to all expected channels
await notificationSuite.verifyMultiChannelDelivery(['email', 'slack', 'teams'])

// Validate specific content across channels
await notificationSuite.validateNotificationContent('email', {
  subject: 'CRITICAL Security Alert',
  contains: ['vulnerability detected', 'immediate action required'],
  severity: 'critical'
})
```

### Delivery Statistics
```typescript
// Get comprehensive delivery statistics
const stats = notificationSuite.getDeliveryStats()
expect(stats.email.successful).toBeGreaterThan(0)
expect(stats.slack.failed).toBeLessThan(stats.slack.total * 0.1) // <10% failure rate
```

## Page Object Model

### Notification Preferences Page
```typescript
const preferencesPage = new NotificationPreferencesPage(page)

// Navigate and configure
await preferencesPage.navigateToNotificationPreferences()
await preferencesPage.configureEmailChannel(['admin@example.com'], 'html')
await preferencesPage.configureSlackChannel('webhook-url', '#alerts', 'SecurityBot')
await preferencesPage.setNotificationFrequency('immediate')
await preferencesPage.savePreferences()
```

### Notification Center Page
```typescript
const notificationCenter = new NotificationCenterPage(page)

// Interact with notifications
await notificationCenter.openNotificationCenter()
await notificationCenter.filterNotifications('security')
await notificationCenter.markAllNotificationsAsRead()
await notificationCenter.verifyToastNotification({ title: 'Security Alert' })
```

## CI/CD Integration

### GitHub Actions Configuration
The tests are integrated into the existing GitHub Actions pipeline:

```yaml
# .github/workflows/e2e.yml (already exists, enhanced for notifications)
- name: Run Notification E2E Tests
  run: |
    npm run test:e2e -- tests/e2e/notifications.spec.ts
    npm run test:e2e -- tests/e2e/notifications.spec.ts --project="Mobile Chrome"
```

### Test Reporting
- **HTML Report**: Generated in `playwright-report/`
- **JUnit XML**: Generated in `test-results/junit.xml`
- **Screenshots**: Captured on failure in `test-results/`
- **Videos**: Recorded for failed tests

## Debugging and Troubleshooting

### Common Issues

1. **Mock Service Timeouts**
   ```typescript
   // Increase delivery delays if tests are flaky
   const notificationSuite = new NotificationTestSuite(page, {
     deliveryDelay: 500 // Increase from default 100-200ms
   })
   ```

2. **API Route Mocking**
   ```typescript
   // Ensure proper API mocking for notification endpoints
   await page.route('**/api/notifications/**', (route) => {
     // Mock implementation
   })
   ```

3. **Timing Issues**
   ```typescript
   // Use expect.poll for async verification
   await expect.poll(async () => {
     return await notificationSuite.verifyMultiChannelDelivery(['email'])
   }, { timeout: 10000 }).toBeTruthy()
   ```

### Debug Mode
```bash
# Run with debug output
DEBUG=pw:api npm run test:e2e -- tests/e2e/notifications.spec.ts

# Run with browser dev tools
npm run test:e2e:headed -- tests/e2e/notifications.spec.ts --debug
```

## Test Maintenance

### Adding New Notification Types
1. Add type definition to `src/types/notifications.ts`
2. Create factory method in `notification-test-data.ts`
3. Add mock service handling in relevant mock classes
4. Create test cases in `notifications.spec.ts`

### Adding New Channels
1. Extend `NotificationChannel` type definitions
2. Create new mock service class
3. Add channel support to `NotificationTestSuite`
4. Add page object methods for channel configuration
5. Create comprehensive test coverage

## Coverage and Quality Metrics

### Test Coverage Goals
- **Functional Coverage**: 100% of notification types and channels
- **User Experience**: 100% of preference configuration options  
- **Integration**: 100% of external service failure scenarios
- **Performance**: Validated under 10x normal load
- **Mobile**: 100% responsive design validation

### Quality Assurance
- **ISTQB Compliant**: Following decision table and experience-based testing
- **Cross-Browser**: Validated on Chromium, Firefox, and Safari
- **Mobile Responsive**: Tested on mobile viewports
- **Accessibility**: WCAG compliance validation included
- **Performance**: Load testing with 1000+ notifications/minute

## Dependencies

### External Service Requirements
For integration testing with real services (optional):
- **SendGrid API Key**: For email service testing
- **Slack Webhook URL**: For Slack integration testing  
- **Teams Webhook URL**: For Teams integration testing

### Test Dependencies
- `@playwright/test`: E2E testing framework
- `@types/node`: Node.js type definitions
- Custom type definitions in `src/types/notifications.ts`

All dependencies are handled via the main `package.json` - no additional installations required.