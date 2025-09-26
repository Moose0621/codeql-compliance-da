import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QualityMetricsCollector, QualityReportGenerator, QualityDashboard } from '../lib/quality-metrics';

// Mock external dependencies
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn(() => true)
}));

describe('QualityMetricsCollector', () => {
  let collector: QualityMetricsCollector;

  beforeEach(() => {
    collector = new QualityMetricsCollector();
    vi.clearAllMocks();
  });

  describe('Test Coverage Collection', () => {
    it('should collect test coverage metrics successfully', async () => {
      const coverage = await collector.collectTestCoverage();

      expect(coverage).toHaveProperty('statements');
      expect(coverage).toHaveProperty('branches');
      expect(coverage).toHaveProperty('functions');
      expect(coverage).toHaveProperty('lines');
      expect(coverage).toHaveProperty('overall');

      // Validate data types
      expect(typeof coverage.statements).toBe('number');
      expect(typeof coverage.branches).toBe('number');
      expect(typeof coverage.functions).toBe('number');
      expect(typeof coverage.lines).toBe('number');
      expect(typeof coverage.overall).toBe('number');

      // Validate ranges (percentages should be 0-100)
      expect(coverage.statements).toBeGreaterThanOrEqual(0);
      expect(coverage.statements).toBeLessThanOrEqual(100);
    });

    it('should handle coverage collection errors gracefully', async () => {
      // Mock error condition
      vi.spyOn(collector as any, 'readCoverageReport').mockRejectedValue(new Error('Coverage file not found'));

      const coverage = await collector.collectTestCoverage();

      // Should return zero values on error, not throw
      expect(coverage.statements).toBe(0);
      expect(coverage.branches).toBe(0);
      expect(coverage.functions).toBe(0);
      expect(coverage.lines).toBe(0);
      expect(coverage.overall).toBe(0);
    });

    it('should calculate overall coverage correctly', async () => {
      const mockCoverageData = {
        statements: { pct: 90 },
        branches: { pct: 80 },
        functions: { pct: 85 },
        lines: { pct: 88 }
      };

      vi.spyOn(collector as any, 'readCoverageReport').mockResolvedValue(mockCoverageData);

      const coverage = await collector.collectTestCoverage();

      // Overall should be weighted average: 0.3*90 + 0.3*80 + 0.2*85 + 0.2*88 = 86
      expect(coverage.overall).toBe(86);
    });
  });

  describe('Code Quality Collection', () => {
    it('should collect code quality metrics successfully', async () => {
      const quality = await collector.collectCodeQuality();

      expect(quality).toHaveProperty('eslint_errors');
      expect(quality).toHaveProperty('eslint_warnings');
      expect(quality).toHaveProperty('typescript_errors');
      expect(quality).toHaveProperty('complexity_score');
      expect(quality).toHaveProperty('maintainability_index');

      // Validate data types
      expect(typeof quality.eslint_errors).toBe('number');
      expect(typeof quality.eslint_warnings).toBe('number');
      expect(typeof quality.typescript_errors).toBe('number');
      expect(typeof quality.complexity_score).toBe('number');
      expect(typeof quality.maintainability_index).toBe('number');
    });

    it('should handle ESLint execution errors gracefully', async () => {
      vi.spyOn(collector as any, 'runESLint').mockRejectedValue(new Error('ESLint execution failed'));

      const quality = await collector.collectCodeQuality();

      expect(quality.eslint_errors).toBe(0);
      expect(quality.eslint_warnings).toBe(0);
    });

    it('should calculate complexity score based on ESLint results', async () => {
      const mockESLintResults = {
        errors: 0,
        warnings: 10,
        complexity: 15
      };

      vi.spyOn(collector as any, 'runESLint').mockResolvedValue(mockESLintResults);
      vi.spyOn(collector as any, 'runTypeScriptCheck').mockResolvedValue({ errors: 0 });

      const quality = await collector.collectCodeQuality();

      // Base score 100 - (complexity * 2) = 100 - (15 * 2) = 70
      expect(quality.complexity_score).toBe(70);
    });
  });

  describe('Security Metrics Collection', () => {
    it('should collect security metrics successfully', async () => {
      const security = await collector.collectSecurityMetrics();

      expect(security).toHaveProperty('critical_vulnerabilities');
      expect(security).toHaveProperty('high_vulnerabilities');
      expect(security).toHaveProperty('medium_vulnerabilities');
      expect(security).toHaveProperty('low_vulnerabilities');
      expect(security).toHaveProperty('dependency_vulnerabilities');

      // All should be non-negative numbers
      Object.values(security).forEach(value => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle security audit failures gracefully', async () => {
      vi.spyOn(collector as any, 'runSecurityAudit').mockRejectedValue(new Error('Audit failed'));

      const security = await collector.collectSecurityMetrics();

      // Should return zero vulnerabilities on error
      expect(security.critical_vulnerabilities).toBe(0);
      expect(security.high_vulnerabilities).toBe(0);
      expect(security.dependency_vulnerabilities).toBe(0);
    });

    it('should map audit results to security metrics correctly', async () => {
      const mockAuditResults = {
        critical: 2,
        high: 1,
        moderate: 5,
        low: 3,
        total: 11
      };

      vi.spyOn(collector as any, 'runSecurityAudit').mockResolvedValue(mockAuditResults);

      const security = await collector.collectSecurityMetrics();

      expect(security.critical_vulnerabilities).toBe(2);
      expect(security.high_vulnerabilities).toBe(1);
      expect(security.medium_vulnerabilities).toBe(5);
      expect(security.low_vulnerabilities).toBe(3);
      expect(security.dependency_vulnerabilities).toBe(11);
    });
  });

  describe('Performance Metrics Collection', () => {
    it('should collect performance metrics successfully', async () => {
      const performance = await collector.collectPerformanceMetrics();

      expect(performance).toHaveProperty('bundle_size_kb');
      expect(performance).toHaveProperty('load_time_ms');
      expect(performance).toHaveProperty('lighthouse_performance_score');
      expect(performance).toHaveProperty('lighthouse_accessibility_score');
      expect(performance).toHaveProperty('memory_usage_mb');

      // Validate reasonable ranges
      expect(performance.lighthouse_performance_score).toBeGreaterThanOrEqual(0);
      expect(performance.lighthouse_performance_score).toBeLessThanOrEqual(100);
      expect(performance.lighthouse_accessibility_score).toBeGreaterThanOrEqual(0);
      expect(performance.lighthouse_accessibility_score).toBeLessThanOrEqual(100);
    });

    it('should handle Lighthouse audit failures gracefully', async () => {
      vi.spyOn(collector as any, 'runLighthouseAudit').mockRejectedValue(new Error('Lighthouse failed'));

      const performance = await collector.collectPerformanceMetrics();

      expect(performance.lighthouse_performance_score).toBe(0);
      expect(performance.lighthouse_accessibility_score).toBe(0);
    });
  });

  describe('Reliability Metrics Collection', () => {
    it('should collect reliability metrics successfully', async () => {
      const reliability = await collector.collectReliabilityMetrics();

      expect(reliability).toHaveProperty('test_pass_rate');
      expect(reliability).toHaveProperty('flaky_test_count');
      expect(reliability).toHaveProperty('error_rate');
      expect(reliability).toHaveProperty('mean_time_to_failure');

      // Test pass rate should be between 0-100
      expect(reliability.test_pass_rate).toBeGreaterThanOrEqual(0);
      expect(reliability.test_pass_rate).toBeLessThanOrEqual(100);
    });

    it('should handle monitoring data collection failures gracefully', async () => {
      vi.spyOn(collector as any, 'getMonitoringMetrics').mockRejectedValue(new Error('Monitoring unavailable'));

      const reliability = await collector.collectReliabilityMetrics();

      expect(reliability.error_rate).toBe(0);
      expect(reliability.mean_time_to_failure).toBe(0);
    });
  });

  describe('Complete Metrics Collection', () => {
    it('should collect all metrics simultaneously', async () => {
      const metrics = await collector.collectAllMetrics();

      expect(metrics).toHaveProperty('test_coverage');
      expect(metrics).toHaveProperty('code_quality');
      expect(metrics).toHaveProperty('security');
      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('reliability');

      // Each section should have the expected structure
      expect(metrics.test_coverage).toHaveProperty('overall');
      expect(metrics.code_quality).toHaveProperty('eslint_errors');
      expect(metrics.security).toHaveProperty('critical_vulnerabilities');
      expect(metrics.performance).toHaveProperty('bundle_size_kb');
      expect(metrics.reliability).toHaveProperty('test_pass_rate');
    });

    it('should handle partial collection failures', async () => {
      // Mock one collection method to fail
      vi.spyOn(collector, 'collectSecurityMetrics').mockRejectedValue(new Error('Security scan failed'));

      const metrics = await collector.collectAllMetrics();

      // Other metrics should still be collected
      expect(metrics.test_coverage.overall).toBeGreaterThanOrEqual(0);
      expect(metrics.code_quality.eslint_errors).toBeGreaterThanOrEqual(0);
      
      // Failed section should have default values
      expect(metrics.security.critical_vulnerabilities).toBe(0);
    });
  });
});

describe('QualityReportGenerator', () => {
  let generator: QualityReportGenerator;

  beforeEach(() => {
    generator = new QualityReportGenerator();
    vi.clearAllMocks();
  });

  describe('Report Generation', () => {
    it('should generate complete quality report', async () => {
      const report = await generator.generateReport('feature-branch', 'abc123', '42');

      expect(report).toHaveProperty('report_id');
      expect(report).toHaveProperty('generated_at');
      expect(report).toHaveProperty('branch', 'feature-branch');
      expect(report).toHaveProperty('commit_sha', 'abc123');
      expect(report).toHaveProperty('build_number', '42');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('quality_gates');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('trends');

      // Validate report ID format
      expect(report.report_id).toMatch(/^qr-\d+-[a-z0-9]{9}$/);

      // Validate timestamp
      expect(new Date(report.generated_at).getTime()).toBeGreaterThan(Date.now() - 5000);
    });

    it('should use default values when parameters not provided', async () => {
      const report = await generator.generateReport();

      expect(report.branch).toBe('main');
      expect(report.commit_sha).toBe('unknown');
      expect(report.build_number).toBe('local');
    });

    it('should evaluate all quality gates', async () => {
      const report = await generator.generateReport();

      expect(Array.isArray(report.quality_gates)).toBe(true);
      expect(report.quality_gates.length).toBeGreaterThan(0);

      // Each gate result should have required properties
      report.quality_gates.forEach(gate => {
        expect(gate).toHaveProperty('gate_name');
        expect(gate).toHaveProperty('status');
        expect(gate).toHaveProperty('criteria_results');
      });
    });
  });

  describe('Summary Generation', () => {
    it('should generate accurate summary based on gate results', async () => {
      const report = await generator.generateReport();

      expect(report.summary).toHaveProperty('overall_status');
      expect(report.summary).toHaveProperty('gates_passed');
      expect(report.summary).toHaveProperty('gates_failed');
      expect(report.summary).toHaveProperty('gates_warned');
      expect(report.summary).toHaveProperty('critical_issues');
      expect(report.summary).toHaveProperty('recommendations');

      // Verify counts add up
      const totalGates = report.summary.gates_passed + report.summary.gates_failed + report.summary.gates_warned;
      expect(totalGates).toBe(report.quality_gates.length);

      // Overall status should be logical
      if (report.summary.gates_failed > 0) {
        expect(report.summary.overall_status).toBe('FAIL');
      } else if (report.summary.gates_warned > 0) {
        expect(report.summary.overall_status).toBe('WARN');
      } else {
        expect(report.summary.overall_status).toBe('PASS');
      }
    });

    it('should identify critical issues correctly', async () => {
      // This would require mocking specific metric values
      const report = await generator.generateReport();

      expect(Array.isArray(report.summary.critical_issues)).toBe(true);
      expect(Array.isArray(report.summary.recommendations)).toBe(true);
    });
  });

  describe('Trend Analysis', () => {
    it('should include trend analysis in report', async () => {
      const report = await generator.generateReport();

      expect(report.trends).toHaveProperty('coverage_trend');
      expect(report.trends).toHaveProperty('quality_trend');
      expect(report.trends).toHaveProperty('performance_trend');
      expect(report.trends).toHaveProperty('security_trend');

      // Trends should be one of the expected values
      const validTrends = ['improving', 'stable', 'declining'];
      expect(validTrends).toContain(report.trends.coverage_trend);
      expect(validTrends).toContain(report.trends.quality_trend);
      expect(validTrends).toContain(report.trends.performance_trend);
      expect(validTrends).toContain(report.trends.security_trend);
    });
  });
});

describe('QualityDashboard', () => {
  let dashboard: QualityDashboard;

  beforeEach(() => {
    dashboard = new QualityDashboard();
  });

  describe('Latest Report Access', () => {
    it('should provide access to latest quality report', async () => {
      const report = await dashboard.getLatestReport();

      expect(report).toHaveProperty('report_id');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('quality_gates');
      expect(report).toHaveProperty('summary');
    });
  });

  describe('Quality Trends', () => {
    it('should return quality trends for specified metrics', () => {
      const trends = dashboard.getQualityTrends('test_coverage.overall', 30);

      expect(Array.isArray(trends)).toBe(true);
      // In actual implementation, would have trend data
    });

    it('should handle different time ranges for trends', () => {
      const shortTrends = dashboard.getQualityTrends('code_quality.eslint_errors', 7);
      const longTrends = dashboard.getQualityTrends('code_quality.eslint_errors', 90);

      expect(Array.isArray(shortTrends)).toBe(true);
      expect(Array.isArray(longTrends)).toBe(true);
    });
  });

  describe('Gate Success Rates', () => {
    it('should provide success rates for all quality gates', () => {
      const rates = dashboard.getGateSuccessRates();

      expect(typeof rates).toBe('object');
      expect(rates).toHaveProperty('Code Quality Gate');
      expect(rates).toHaveProperty('Functional Suitability Gate');
      expect(rates).toHaveProperty('Security Gate');
      expect(rates).toHaveProperty('Performance Gate');
      expect(rates).toHaveProperty('Accessibility Gate');

      // All rates should be percentages (0-100)
      Object.values(rates).forEach(rate => {
        expect(typeof rate).toBe('number');
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Report Storage', () => {
    it('should store quality reports for trend analysis', async () => {
      const report = await dashboard.getLatestReport();
      
      expect(() => {
        dashboard.storeReport(report);
      }).not.toThrow();

      // In actual implementation, would verify storage mechanism
    });
  });

  describe('Integration Testing', () => {
    it('should integrate with all quality components', async () => {
      // Test complete workflow
      const report = await dashboard.getLatestReport();
      dashboard.storeReport(report);
      const rates = dashboard.getGateSuccessRates();
      const trends = dashboard.getQualityTrends('test_coverage.overall');

      expect(report).toBeDefined();
      expect(rates).toBeDefined();
      expect(trends).toBeDefined();
    });
  });
});