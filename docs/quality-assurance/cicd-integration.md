# CI/CD Quality Pipeline Configuration

## GitHub Actions Workflow for Quality Assurance

```yaml
name: Quality Assurance Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '18'
  QUALITY_GATE_STRICT: true

jobs:
  # Phase 1: Pre-commit Quality Gate
  code-quality:
    name: Code Quality Gate
    runs-on: ubuntu-latest
    outputs:
      quality-status: ${{ steps.quality-check.outputs.status }}
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: TypeScript compilation check
        run: npm run typecheck
        
      - name: ESLint validation
        run: npm run lint -- --format=json --output-file=eslint-report.json
        
      - name: Code Quality Gate Evaluation
        id: quality-check
        run: |
          node scripts/evaluate-quality-gate.js code-quality
          echo "status=$?" >> $GITHUB_OUTPUT
          
      - name: Upload ESLint Report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: eslint-report
          path: eslint-report.json

  # Phase 2: Functional Suitability Gate
  functional-testing:
    name: Functional Suitability Gate
    runs-on: ubuntu-latest
    needs: code-quality
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run unit tests with coverage
        run: npm run test -- --coverage --reporter=json --outputFile=test-results.json
        
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
          
      - name: Functional Quality Gate Evaluation
        run: node scripts/evaluate-quality-gate.js functional-suitability
        
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: |
            test-results.json
            coverage/

  # Phase 3: Security Gate
  security-testing:
    name: Security Gate
    runs-on: ubuntu-latest
    needs: code-quality
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run npm audit
        run: npm audit --audit-level=moderate --json > security-audit.json || true
        
      - name: Run Semgrep security scan
        uses: semgrep/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/secrets
            p/typescript
            p/react
        env:
          SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}
          
      - name: Security Quality Gate Evaluation
        run: node scripts/evaluate-quality-gate.js security
        
      - name: Upload security reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: security-reports
          path: |
            security-audit.json
            semgrep-report.json

  # Phase 4: Build and Performance Gate
  build-and-performance:
    name: Build & Performance Gate
    runs-on: ubuntu-latest
    needs: [functional-testing, security-testing]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build application
        run: npm run build
        
      - name: Analyze bundle size
        run: |
          npx webpack-bundle-analyzer dist/assets/*.js --report --format json > bundle-analysis.json
          
      - name: Run Lighthouse audit
        uses: treosh/lighthouse-ci-action@v10
        with:
          configPath: './lighthouse.config.json'
          uploadArtifacts: true
          temporaryPublicStorage: true
          
      - name: Performance Quality Gate Evaluation
        run: node scripts/evaluate-quality-gate.js performance
        
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: |
            dist/
            bundle-analysis.json
            .lighthouseci/

  # Phase 5: E2E and Accessibility Testing
  e2e-accessibility:
    name: E2E & Accessibility Gate
    runs-on: ubuntu-latest
    needs: build-and-performance
    
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
        
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Install Playwright browsers
        run: npx playwright install ${{ matrix.browser }}
        
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts
          path: dist/
          
      - name: Run E2E tests
        run: npx playwright test --project=${{ matrix.browser }}
        
      - name: Run accessibility tests
        run: npx pa11y-ci --sitemap http://localhost:4173/sitemap.xml
        
      - name: Accessibility Quality Gate Evaluation
        run: node scripts/evaluate-quality-gate.js accessibility
        
      - name: Upload E2E test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: e2e-results-${{ matrix.browser }}
          path: |
            test-results/
            playwright-report/

  # Phase 6: Quality Report Generation
  quality-report:
    name: Generate Quality Report
    runs-on: ubuntu-latest
    needs: [functional-testing, security-testing, build-and-performance, e2e-accessibility]
    if: always()
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Download all artifacts
        uses: actions/download-artifact@v3
        
      - name: Generate comprehensive quality report
        run: node scripts/generate-quality-report.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          BRANCH: ${{ github.ref_name }}
          COMMIT_SHA: ${{ github.sha }}
          BUILD_NUMBER: ${{ github.run_number }}
          
      - name: Upload quality report
        uses: actions/upload-artifact@v3
        with:
          name: quality-report
          path: quality-report.html
          
      - name: Comment PR with quality report
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('quality-summary.md', 'utf8');
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: report
            });

  # Phase 7: Deployment Gates (Production only)
  deployment-gate:
    name: Deployment Quality Gate
    runs-on: ubuntu-latest
    needs: quality-report
    if: github.ref == 'refs/heads/main' && needs.quality-report.result == 'success'
    
    steps:
      - name: Evaluate deployment readiness
        run: node scripts/evaluate-deployment-readiness.js
        
      - name: Notify deployment status
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          text: 'Quality gates passed - Ready for deployment'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

## Quality Gate Evaluation Scripts

### scripts/evaluate-quality-gate.js
```javascript
#!/usr/bin/env node

const { QualityMetricsCollector, QualityReportGenerator } = require('../src/lib/quality-metrics');
const { QualityGateEvaluator, QUALITY_GATES } = require('../src/lib/quality-gates');

async function evaluateQualityGate(gateName) {
  try {
    console.log(`Evaluating quality gate: ${gateName}`);
    
    // Collect current metrics
    const collector = new QualityMetricsCollector();
    const metrics = await collector.collectAllMetrics();
    
    // Find and evaluate the specified gate
    const gate = QUALITY_GATES.find(g => 
      g.name.toLowerCase().replace(/\s+/g, '-') === gateName.toLowerCase()
    );
    
    if (!gate) {
      console.error(`Quality gate not found: ${gateName}`);
      process.exit(1);
    }
    
    const evaluator = new QualityGateEvaluator(metrics);
    const result = evaluator.evaluateGate(gate);
    
    // Output results
    console.log(`Gate Status: ${result.status}`);
    console.log(`Criteria Results:`);
    
    for (const criteria of result.criteria_results) {
      const icon = criteria.status === 'PASS' ? '✅' : '❌';
      console.log(`  ${icon} ${criteria.message}`);
    }
    
    // Write detailed results for artifact upload
    require('fs').writeFileSync(
      `quality-gate-${gateName}.json`,
      JSON.stringify(result, null, 2)
    );
    
    // Exit with appropriate code
    if (result.status === 'FAIL' && gate.required) {
      console.error('Required quality gate failed');
      process.exit(1);
    } else if (result.status === 'WARN') {
      console.warn('Quality gate passed with warnings');
      process.exit(0);
    } else {
      console.log('Quality gate passed');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('Quality gate evaluation failed:', error);
    process.exit(1);
  }
}

// Run the evaluation
const gateName = process.argv[2];
if (!gateName) {
  console.error('Usage: evaluate-quality-gate.js <gate-name>');
  process.exit(1);
}

evaluateQualityGate(gateName);
```

### scripts/generate-quality-report.js
```javascript
#!/usr/bin/env node

const { QualityReportGenerator } = require('../src/lib/quality-metrics');
const fs = require('fs');
const path = require('path');

async function generateQualityReport() {
  try {
    const generator = new QualityReportGenerator();
    
    const report = await generator.generateReport(
      process.env.BRANCH || 'main',
      process.env.COMMIT_SHA || 'unknown',
      process.env.BUILD_NUMBER || 'local'
    );
    
    // Generate HTML report
    const htmlReport = generateHTMLReport(report);
    fs.writeFileSync('quality-report.html', htmlReport);
    
    // Generate markdown summary for PR comments
    const markdownSummary = generateMarkdownSummary(report);
    fs.writeFileSync('quality-summary.md', markdownSummary);
    
    // Generate JSON report for programmatic access
    fs.writeFileSync('quality-report.json', JSON.stringify(report, null, 2));
    
    console.log('Quality report generated successfully');
    console.log(`Overall Status: ${report.summary.overall_status}`);
    console.log(`Gates Passed: ${report.summary.gates_passed}`);
    console.log(`Gates Failed: ${report.summary.gates_failed}`);
    
  } catch (error) {
    console.error('Quality report generation failed:', error);
    process.exit(1);
  }
}

function generateHTMLReport(report) {
  // HTML template for quality report
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quality Report - ${report.branch}@${report.commit_sha.substring(0, 7)}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 2rem; }
        .status-pass { color: #28a745; }
        .status-fail { color: #dc3545; }
        .status-warn { color: #ffc107; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; }
        .metric-card { border: 1px solid #dee2e6; border-radius: 8px; padding: 1rem; }
        .gate-result { margin: 1rem 0; padding: 1rem; border-radius: 8px; }
        .gate-pass { background-color: #d4edda; }
        .gate-fail { background-color: #f8d7da; }
        .gate-warn { background-color: #fff3cd; }
    </style>
</head>
<body>
    <h1>Quality Assurance Report</h1>
    <div class="report-header">
        <p><strong>Branch:</strong> ${report.branch}</p>
        <p><strong>Commit:</strong> ${report.commit_sha}</p>
        <p><strong>Build:</strong> ${report.build_number}</p>
        <p><strong>Generated:</strong> ${report.generated_at}</p>
        <p><strong>Overall Status:</strong> <span class="status-${report.summary.overall_status.toLowerCase()}">${report.summary.overall_status}</span></p>
    </div>
    
    <h2>Quality Metrics</h2>
    <div class="metrics-grid">
        ${generateMetricsCards(report.metrics)}
    </div>
    
    <h2>Quality Gates</h2>
    ${report.quality_gates.map(gate => `
        <div class="gate-result gate-${gate.status.toLowerCase()}">
            <h3>${gate.gate_name} - ${gate.status}</h3>
            <ul>
                ${gate.criteria_results.map(c => `<li class="status-${c.status.toLowerCase()}">${c.message}</li>`).join('')}
            </ul>
        </div>
    `).join('')}
    
    <h2>Summary</h2>
    <ul>
        ${report.summary.critical_issues.map(issue => `<li class="status-fail">${issue}</li>`).join('')}
        ${report.summary.recommendations.map(rec => `<li class="status-warn">${rec}</li>`).join('')}
    </ul>
</body>
</html>`;
}

function generateMetricsCards(metrics) {
  return `
    <div class="metric-card">
        <h3>Test Coverage</h3>
        <p>Overall: ${metrics.test_coverage.overall}%</p>
        <p>Statements: ${metrics.test_coverage.statements}%</p>
        <p>Branches: ${metrics.test_coverage.branches}%</p>
        <p>Functions: ${metrics.test_coverage.functions}%</p>
    </div>
    <div class="metric-card">
        <h3>Code Quality</h3>
        <p>ESLint Errors: ${metrics.code_quality.eslint_errors}</p>
        <p>ESLint Warnings: ${metrics.code_quality.eslint_warnings}</p>
        <p>TypeScript Errors: ${metrics.code_quality.typescript_errors}</p>
    </div>
    <div class="metric-card">
        <h3>Security</h3>
        <p>Critical Vulnerabilities: ${metrics.security.critical_vulnerabilities}</p>
        <p>High Vulnerabilities: ${metrics.security.high_vulnerabilities}</p>
        <p>Total Dependencies: ${metrics.security.dependency_vulnerabilities}</p>
    </div>
    <div class="metric-card">
        <h3>Performance</h3>
        <p>Bundle Size: ${metrics.performance.bundle_size_kb} KB</p>
        <p>Lighthouse Score: ${metrics.performance.lighthouse_performance_score}</p>
        <p>Load Time: ${metrics.performance.load_time_ms} ms</p>
    </div>
  `;
}

function generateMarkdownSummary(report) {
  const statusIcon = {
    'PASS': '✅',
    'FAIL': '❌',
    'WARN': '⚠️'
  };
  
  return `
## Quality Assurance Report ${statusIcon[report.summary.overall_status]}

**Branch:** ${report.branch}  
**Commit:** ${report.commit_sha.substring(0, 7)}  
**Build:** ${report.build_number}  

### Quality Gates Summary
- ✅ Passed: ${report.summary.gates_passed}
- ❌ Failed: ${report.summary.gates_failed}  
- ⚠️ Warnings: ${report.summary.gates_warned}

### Key Metrics
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Test Coverage | ${report.metrics.test_coverage.overall}% | >90% | ${report.metrics.test_coverage.overall >= 90 ? '✅' : '❌'} |
| ESLint Errors | ${report.metrics.code_quality.eslint_errors} | 0 | ${report.metrics.code_quality.eslint_errors === 0 ? '✅' : '❌'} |
| Security Issues | ${report.metrics.security.critical_vulnerabilities + report.metrics.security.high_vulnerabilities} | 0 | ${(report.metrics.security.critical_vulnerabilities + report.metrics.security.high_vulnerabilities) === 0 ? '✅' : '❌'} |
| Performance Score | ${report.metrics.performance.lighthouse_performance_score} | >90 | ${report.metrics.performance.lighthouse_performance_score >= 90 ? '✅' : '❌'} |

${report.summary.critical_issues.length > 0 ? `
### Critical Issues
${report.summary.critical_issues.map(issue => `- ❌ ${issue}`).join('\n')}
` : ''}

${report.summary.recommendations.length > 0 ? `
### Recommendations  
${report.summary.recommendations.map(rec => `- 💡 ${rec}`).join('\n')}
` : ''}
  `;
}

generateQualityReport();
```

## Configuration Files

### lighthouse.config.json
```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:4173"],
      "startServerCommand": "npm run preview",
      "startServerReadyPattern": "Local:.*4173"
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.9}],
        "categories:accessibility": ["error", {"minScore": 0.95}],
        "categories:best-practices": ["error", {"minScore": 0.9}],
        "categories:seo": ["error", {"minScore": 0.8}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

### .pa11yci.json
```json
{
  "defaults": {
    "timeout": 30000,
    "wait": 1000,
    "chromeLaunchConfig": {
      "ignoreHTTPSErrors": false
    }
  },
  "urls": [
    "http://localhost:4173",
    "http://localhost:4173/?repo=test-repo",
    "http://localhost:4173/#security-analytics",
    "http://localhost:4173/#audit-trail"
  ]
}
```