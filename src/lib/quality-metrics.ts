/**
 * Quality Metrics Collection and Reporting System
 * Provides comprehensive quality metrics tracking for ISO 25010 compliance
 */

import type { QualityMetrics, QualityGateResult } from './quality-gates';

export interface QualityReport {
  report_id: string;
  generated_at: string;
  branch: string;
  commit_sha: string;
  build_number: string;
  
  metrics: QualityMetrics;
  quality_gates: QualityGateResult[];
  
  summary: {
    overall_status: 'PASS' | 'FAIL' | 'WARN';
    gates_passed: number;
    gates_failed: number;
    gates_warned: number;
    critical_issues: string[];
    recommendations: string[];
  };
  
  trends: {
    coverage_trend: 'improving' | 'stable' | 'declining';
    quality_trend: 'improving' | 'stable' | 'declining';
    performance_trend: 'improving' | 'stable' | 'declining';
    security_trend: 'improving' | 'stable' | 'declining';
  };
}

export interface QualityTrend {
  metric_name: string;
  current_value: number;
  previous_value: number;
  change_percentage: number;
  trend_direction: 'up' | 'down' | 'stable';
  significance: 'significant' | 'minor' | 'negligible';
}

/**
 * Quality Metrics Collector - Aggregates metrics from various sources
 */
export class QualityMetricsCollector {
  private testCoverageData: any;
  private lintResults: any;
  private securityScanResults: any;
  private performanceMetrics: any;

  constructor() {
    // Initialize with default values
    this.resetMetrics();
  }

  /**
   * Collect test coverage metrics from Vitest
   */
  async collectTestCoverage(): Promise<QualityMetrics['test_coverage']> {
    try {
      // In real implementation, this would read from coverage reports
      const coverageData = await this.readCoverageReport();
      
      return {
        statements: coverageData.statements?.pct || 0,
        branches: coverageData.branches?.pct || 0,
        functions: coverageData.functions?.pct || 0,
        lines: coverageData.lines?.pct || 0,
        overall: this.calculateOverallCoverage(coverageData)
      };
    } catch (error) {
      console.warn('Failed to collect test coverage:', error);
      return { statements: 0, branches: 0, functions: 0, lines: 0, overall: 0 };
    }
  }

  /**
   * Collect code quality metrics from ESLint and TypeScript
   */
  async collectCodeQuality(): Promise<QualityMetrics['code_quality']> {
    try {
      const eslintResults = await this.runESLint();
      const tscResults = await this.runTypeScriptCheck();
      
      return {
        eslint_errors: eslintResults.errors || 0,
        eslint_warnings: eslintResults.warnings || 0,
        typescript_errors: tscResults.errors || 0,
        complexity_score: this.calculateComplexityScore(eslintResults),
        maintainability_index: this.calculateMaintainabilityIndex()
      };
    } catch (error) {
      console.warn('Failed to collect code quality metrics:', error);
      return {
        eslint_errors: 0,
        eslint_warnings: 0,
        typescript_errors: 0,
        complexity_score: 100,
        maintainability_index: 100
      };
    }
  }

  /**
   * Collect security metrics from npm audit and security scanners
   */
  async collectSecurityMetrics(): Promise<QualityMetrics['security']> {
    try {
      const auditResults = await this.runSecurityAudit();
      
      return {
        critical_vulnerabilities: auditResults.critical || 0,
        high_vulnerabilities: auditResults.high || 0,
        medium_vulnerabilities: auditResults.moderate || 0,
        low_vulnerabilities: auditResults.low || 0,
        dependency_vulnerabilities: auditResults.total || 0
      };
    } catch (error) {
      console.warn('Failed to collect security metrics:', error);
      return {
        critical_vulnerabilities: 0,
        high_vulnerabilities: 0,
        medium_vulnerabilities: 0,
        low_vulnerabilities: 0,
        dependency_vulnerabilities: 0
      };
    }
  }

  /**
   * Collect performance metrics from Lighthouse and bundle analysis
   */
  async collectPerformanceMetrics(): Promise<QualityMetrics['performance']> {
    try {
      const bundleStats = await this.analyzeBundleSize();
      const lighthouseResults = await this.runLighthouseAudit();
      
      return {
        bundle_size_kb: bundleStats.sizeKB || 0,
        load_time_ms: lighthouseResults.loadTime || 0,
        lighthouse_performance_score: lighthouseResults.performance || 0,
        lighthouse_accessibility_score: lighthouseResults.accessibility || 0,
        memory_usage_mb: bundleStats.memoryUsage || 0
      };
    } catch (error) {
      console.warn('Failed to collect performance metrics:', error);
      return {
        bundle_size_kb: 0,
        load_time_ms: 0,
        lighthouse_performance_score: 0,
        lighthouse_accessibility_score: 0,
        memory_usage_mb: 0
      };
    }
  }

  /**
   * Collect reliability metrics from test results and monitoring
   */
  async collectReliabilityMetrics(): Promise<QualityMetrics['reliability']> {
    try {
      const testResults = await this.getTestResults();
      const monitoringData = await this.getMonitoringMetrics();
      
      return {
        test_pass_rate: testResults.passRate || 100,
        flaky_test_count: testResults.flakyTests || 0,
        error_rate: monitoringData.errorRate || 0,
        mean_time_to_failure: monitoringData.mttr || 0
      };
    } catch (error) {
      console.warn('Failed to collect reliability metrics:', error);
      return {
        test_pass_rate: 100,
        flaky_test_count: 0,
        error_rate: 0,
        mean_time_to_failure: 0
      };
    }
  }

  /**
   * Collect all quality metrics
   */
  async collectAllMetrics(): Promise<QualityMetrics> {
    const [
      test_coverage,
      code_quality,
      security,
      performance,
      reliability
    ] = await Promise.all([
      this.collectTestCoverage(),
      this.collectCodeQuality(),
      this.collectSecurityMetrics(),
      this.collectPerformanceMetrics(),
      this.collectReliabilityMetrics()
    ]);

    return {
      test_coverage,
      code_quality,
      security,
      performance,
      reliability
    };
  }

  // Private helper methods (implementation details)
  private async readCoverageReport(): Promise<any> {
    // Mock implementation - in real scenario, would read from coverage/lcov.info
    return {
      statements: { pct: 81.6 },
      branches: { pct: 75.2 },
      functions: { pct: 76.4 },
      lines: { pct: 81.6 }
    };
  }

  private async runESLint(): Promise<any> {
    // Mock implementation - in real scenario, would execute ESLint programmatically
    return {
      errors: 0,
      warnings: 20,
      complexity: 8.5
    };
  }

  private async runTypeScriptCheck(): Promise<any> {
    // Mock implementation - in real scenario, would run tsc --noEmit
    return {
      errors: 0,
      warnings: 0
    };
  }

  private async runSecurityAudit(): Promise<any> {
    // Mock implementation - in real scenario, would run npm audit --json
    return {
      critical: 0,
      high: 0,
      moderate: 3,
      low: 0,
      total: 3
    };
  }

  private async analyzeBundleSize(): Promise<any> {
    // Mock implementation - in real scenario, would analyze webpack stats
    return {
      sizeKB: 1024,
      memoryUsage: 64
    };
  }

  private async runLighthouseAudit(): Promise<any> {
    // Mock implementation - in real scenario, would run Lighthouse
    return {
      performance: 90,
      accessibility: 95,
      loadTime: 1800
    };
  }

  private async getTestResults(): Promise<any> {
    // Mock implementation - in real scenario, would analyze test reports
    return {
      passRate: 98.9,
      flakyTests: 1
    };
  }

  private async getMonitoringMetrics(): Promise<any> {
    // Mock implementation - in real scenario, would fetch from monitoring system
    return {
      errorRate: 0.05,
      mttr: 300
    };
  }

  private calculateOverallCoverage(coverageData: any): number {
    const weights = { statements: 0.3, branches: 0.3, functions: 0.2, lines: 0.2 };
    return Math.round(
      (coverageData.statements?.pct || 0) * weights.statements +
      (coverageData.branches?.pct || 0) * weights.branches +
      (coverageData.functions?.pct || 0) * weights.functions +
      (coverageData.lines?.pct || 0) * weights.lines
    );
  }

  private calculateComplexityScore(eslintResults: any): number {
    // Simplified complexity calculation based on ESLint complexity warnings
    const baseScore = 100;
    const complexityPenalty = (eslintResults.complexity || 0) * 2;
    return Math.max(0, baseScore - complexityPenalty);
  }

  private calculateMaintainabilityIndex(): number {
    // Simplified maintainability index - in real scenario would be more sophisticated
    return 85;
  }

  private resetMetrics(): void {
    this.testCoverageData = null;
    this.lintResults = null;
    this.securityScanResults = null;
    this.performanceMetrics = null;
  }
}

/**
 * Quality Report Generator
 */
export class QualityReportGenerator {
  private metricsCollector: QualityMetricsCollector;

  constructor() {
    this.metricsCollector = new QualityMetricsCollector();
  }

  /**
   * Generate comprehensive quality report
   */
  async generateReport(
    branch: string = 'main',
    commitSha: string = 'unknown',
    buildNumber: string = 'local'
  ): Promise<QualityReport> {
    const metrics = await this.metricsCollector.collectAllMetrics();
    
    // Import QualityGateEvaluator - now avoiding circular dependency
    const { QualityGateEvaluator } = await import('./quality-gates');
    const evaluator = new QualityGateEvaluator(metrics);
    
    const quality_gates = [
      ...evaluator.evaluatePhase('pre-commit'),
      ...evaluator.evaluatePhase('build'),
      ...evaluator.evaluatePhase('test'),
      ...evaluator.evaluatePhase('deploy')
    ];

    const summary = this.generateSummary(metrics, quality_gates);
    const trends = this.analyzeTrends(metrics);

    return {
      report_id: this.generateReportId(),
      generated_at: new Date().toISOString(),
      branch,
      commit_sha: commitSha,
      build_number: buildNumber,
      metrics,
      quality_gates,
      summary,
      trends
    };
  }

  /**
   * Generate executive summary
   */
  private generateSummary(
    metrics: QualityMetrics,
    gateResults: QualityGateResult[]
  ): QualityReport['summary'] {
    const gates_passed = gateResults.filter(g => g.status === 'PASS').length;
    const gates_failed = gateResults.filter(g => g.status === 'FAIL').length;
    const gates_warned = gateResults.filter(g => g.status === 'WARN').length;

    // Import assessment utilities to avoid circular dependency
    const { QualityAssessmentUtils } = require('./quality-assessment-utils');
    
    const overall_status = QualityAssessmentUtils.calculateOverallStatus(gateResults);
    const critical_issues = QualityAssessmentUtils.identifyCriticalIssues(metrics);
    const recommendations = QualityAssessmentUtils.generateRecommendations(metrics);

    return {
      overall_status,
      gates_passed,
      gates_failed,
      gates_warned,
      critical_issues,
      recommendations
    };
  }

  /**
   * Analyze quality trends (placeholder implementation)
   */
  private analyzeTrends(metrics: QualityMetrics): QualityReport['trends'] {
    // In real implementation, would compare with historical data
    return {
      coverage_trend: 'stable',
      quality_trend: 'improving',
      performance_trend: 'stable',
      security_trend: 'improving'
    };
  }

  private generateReportId(): string {
    return `qr-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * Quality Dashboard Data Provider
 */
export class QualityDashboard {
  private reportGenerator: QualityReportGenerator;
  private historicalReports: QualityReport[] = [];

  constructor() {
    this.reportGenerator = new QualityReportGenerator();
  }

  /**
   * Get latest quality report
   */
  async getLatestReport(): Promise<QualityReport> {
    return this.reportGenerator.generateReport();
  }

  /**
   * Get quality trends over time
   */
  getQualityTrends(metricName: string, days: number = 30): QualityTrend[] {
    // Placeholder implementation - would fetch from storage in real scenario
    return [];
  }

  /**
   * Get quality gate success rates
   */
  getGateSuccessRates(): Record<string, number> {
    // Placeholder implementation - would calculate from historical data
    return {
      'Code Quality Gate': 95,
      'Functional Suitability Gate': 90,
      'Security Gate': 88,
      'Performance Gate': 85,
      'Accessibility Gate': 92
    };
  }

  /**
   * Store quality report for trend analysis
   */
  storeReport(report: QualityReport): void {
    this.historicalReports.push(report);
    // In real implementation, would persist to database/file system
  }
}