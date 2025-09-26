# Advanced Repository Filtering E2E Tests

This directory contains comprehensive end-to-end tests for the advanced repository filtering system of the CodeQL Compliance Dashboard. The test suite follows ISTQB testing standards and implements the Page Object Model pattern for maintainable and scalable test automation.

## Test Architecture

### Page Object Model (POM)
- **FilterPage**: Manages all filter control interactions and validation
- **RepositoryListPage**: Handles repository result verification and performance testing
- **PresetManagementPage**: Covers filter preset operations and management
- **SearchBoxComponent**: Focuses on search input interactions and boolean operators

### Test Data Management
- **TestDataGenerator**: Creates realistic repository datasets for comprehensive testing
- **GitHubAPIMock**: Provides consistent API responses without external dependencies

## Test Coverage

### 1. Functional Tests (`advanced-filtering.spec.ts`)
#### Multi-Criteria Filtering
- ✅ Simultaneous filter application (language + severity + topic)
- ✅ Individual filter type validation  
- ✅ Filter combination testing with expected results
- ✅ Empty result state handling
- ✅ Filter reset and state restoration

#### Boolean Search Operators
- ✅ AND operations: `typescript AND security`
- ✅ OR operations: `language:(TypeScript OR JavaScript)`
- ✅ NOT operations: `NOT archived:true`
- ✅ Complex expressions with precedence
- ✅ Invalid syntax error handling

#### Filter Presets
- ✅ Preset selection and application
- ✅ Custom preset creation from current state
- ✅ Preset management (edit, delete, rename)
- ✅ Preset export/import functionality
- ✅ Default preset validation

#### State Persistence
- ✅ URL parameter synchronization
- ✅ Browser navigation (back/forward) handling
- ✅ Session persistence across refresh
- ✅ Local storage for user preferences

### 2. Performance Tests (`performance-accessibility.spec.ts`)
#### Large Dataset Testing
- ✅ 1000+ repository filtering response time validation
- ✅ Search debouncing verification (300ms delay)
- ✅ Memory usage monitoring during heavy operations
- ✅ Progressive loading for large result sets

#### Performance Benchmarking
- ✅ Dataset size scaling analysis (100, 500, 1000+ repos)
- ✅ API call optimization validation
- ✅ Client-side filtering performance metrics

### 3. Accessibility Tests (`performance-accessibility.spec.ts`)
#### Keyboard Navigation
- ✅ Tab order validation through filter controls
- ✅ ARIA label and announcement verification
- ✅ Focus management during filter changes
- ✅ Modal focus trap testing

#### Screen Reader Compatibility
- ✅ Semantic structure validation (headings, landmarks)
- ✅ Form control labeling verification
- ✅ Dynamic content change announcements
- ✅ Live region implementation testing

#### Visual Accessibility
- ✅ High contrast mode compatibility
- ✅ Color contrast validation
- ✅ Focus indicator visibility
- ✅ Touch target size compliance (44px minimum)

### 4. Responsive Design Tests (`responsive-design.spec.ts`)
#### Cross-Device Compatibility
- ✅ Mobile layout usability (320px - 812px)
- ✅ Tablet experience optimization (768px - 1024px)
- ✅ Touch interaction validation
- ✅ Orientation change handling

#### Progressive Enhancement
- ✅ Mobile filter drawer functionality
- ✅ Touch-friendly element sizing
- ✅ Network connectivity failure handling
- ✅ Performance optimization for limited devices

### 5. Visual Regression Tests (`visual-regression.spec.ts`)
#### UI State Consistency
- ✅ Default filter interface screenshots
- ✅ Active filter state comparisons
- ✅ Dark mode and high contrast validation
- ✅ Cross-browser visual consistency

#### Animation and Interaction States
- ✅ Hover state captures
- ✅ Focus state validation
- ✅ Loading and error state documentation
- ✅ Mobile responsive layout verification

## Running Tests

### Prerequisites
```bash
npm install
npx playwright install
```

### Individual Test Suites
```bash
# Functional tests
npx playwright test advanced-filtering.spec.ts

# Performance & accessibility tests
npx playwright test performance-accessibility.spec.ts

# Responsive design tests
npx playwright test responsive-design.spec.ts

# Visual regression tests
npx playwright test visual-regression.spec.ts
```

### Full Test Suite
```bash
npm run test:e2e
```

### Interactive Testing
```bash
# Run with UI for debugging
npm run test:e2e:ui

# Run with headed browser
npm run test:e2e:headed
```

## Test Configuration

### Browser Support
- ✅ Chromium (Desktop & Mobile Chrome)
- ✅ Firefox (Desktop)
- ✅ WebKit (Desktop & Mobile Safari)

### Viewport Testing
- **Mobile Small**: 320×568 (iPhone 5)
- **Mobile Large**: 375×812 (iPhone X)
- **Tablet**: 768×1024 (iPad)
- **Desktop**: 1440×900 (Standard desktop)

### Network Conditions
- Standard connection (default)
- Slow 3G simulation (performance tests)
- Offline scenario testing (error handling)

## Test Data

### Repository Dataset Sizes
- **Default**: 50 repositories with diverse characteristics
- **Performance**: 1000+ repositories for scale testing
- **Special Cases**: Curated sets for specific filter testing

### Mock API Responses
- Realistic GitHub API response structure
- Pagination support for large datasets
- Rate limiting simulation
- Error scenario coverage

## Best Practices

### Test Isolation
- Each test starts with a clean state
- API mocks reset between tests
- Browser storage cleared automatically

### Performance Considerations
- Large datasets generated only for performance tests
- Visual regression tests use smaller, consistent datasets
- Debounce timing validated to prevent flaky tests

### Error Handling
- Network failure scenarios tested
- Invalid input handling validated
- Graceful degradation verified

## Maintenance

### Adding New Tests
1. Follow the Page Object Model pattern
2. Use consistent test-id attributes for element targeting
3. Include both positive and negative test scenarios
4. Add visual regression tests for UI changes

### Updating Test Data
1. Modify `TestDataGenerator` for new repository characteristics
2. Update `GitHubAPIMock` for new API endpoints
3. Regenerate visual regression baselines when UI changes

### CI/CD Integration
Tests are configured to run in GitHub Actions with:
- Parallel execution across browsers
- Screenshot capture on failure
- Performance benchmark tracking
- HTML report generation

## Troubleshooting

### Common Issues
- **Flaky tests**: Increase wait times or improve element targeting
- **Visual regression failures**: Review UI changes and update baselines
- **Performance test failures**: Check dataset generation and network conditions

### Debug Commands
```bash
# Run specific test with debug output
npx playwright test --debug advanced-filtering.spec.ts

# Generate test report
npx playwright show-report

# Update visual regression baselines
npx playwright test --update-snapshots visual-regression.spec.ts
```

## Contributing

When adding new filtering features:
1. Add appropriate test-id attributes to components
2. Create corresponding page object methods
3. Write comprehensive test scenarios covering edge cases
4. Include accessibility and performance considerations
5. Update visual regression tests for UI changes

## Metrics & Reporting

### Test Coverage
- **Functional**: 95+ test scenarios covering all filter combinations
- **Performance**: Response time validation for 1000+ repositories
- **Accessibility**: WCAG 2.1 AA compliance verification
- **Visual**: Cross-browser and theme consistency validation

### Performance Benchmarks
- Initial load: <5 seconds for 1000+ repositories
- Filter application: <2 seconds for complex multi-criteria
- Search debouncing: 300ms delay validated
- Memory usage: <50MB increase during heavy operations

The test suite provides comprehensive validation ensuring the advanced repository filtering system meets enterprise-grade reliability, performance, and accessibility standards.