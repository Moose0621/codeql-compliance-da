/**
 * Quality Gate Evaluation Utilities
 * Separate module to avoid circular dependencies between quality-gates and quality-metrics
 */

import type { QualityMetrics, QualityGateResult } from './quality-gates';

/**
 * Utility functions for quality assessment and reporting
 */
export class QualityAssessmentUtils {
  /**
   * Analyze metrics and generate critical issues
   */
  static identifyCriticalIssues(metrics: QualityMetrics): string[] {
    const issues: string[] = [];

    if (metrics.test_coverage.overall < 85) {
      issues.push(`Test coverage at ${metrics.test_coverage.overall}% - below 85% threshold`);
    }

    if (metrics.security.critical_vulnerabilities > 0) {
      issues.push(`${metrics.security.critical_vulnerabilities} critical security vulnerabilities found`);
    }

    if (metrics.security.high_vulnerabilities > 0) {
      issues.push(`${metrics.security.high_vulnerabilities} high-severity security vulnerabilities found`);
    }

    if (metrics.code_quality.eslint_errors > 0) {
      issues.push(`${metrics.code_quality.eslint_errors} ESLint errors must be resolved`);
    }

    if (metrics.performance.load_time_ms > 2000) {
      issues.push(`Page load time ${metrics.performance.load_time_ms}ms exceeds 2s target`);
    }

    return issues;
  }

  /**
   * Generate quality improvement recommendations
   */
  static generateRecommendations(metrics: QualityMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.test_coverage.overall < 90) {
      recommendations.push('Increase test coverage, especially for new features');
    }

    if (metrics.test_coverage.branches < 80) {
      recommendations.push('Focus on improving branch coverage with edge case testing');
    }

    if (metrics.code_quality.eslint_warnings > 5) {
      recommendations.push('Address ESLint warnings to improve code maintainability');
    }

    if (metrics.security.dependency_vulnerabilities > 3) {
      recommendations.push('Update dependencies to address security vulnerabilities');
    }

    if (metrics.performance.lighthouse_performance_score < 90) {
      recommendations.push('Optimize performance to achieve >90 Lighthouse score');
    }

    if (metrics.performance.lighthouse_accessibility_score < 95) {
      recommendations.push('Improve accessibility compliance to meet WCAG 2.1 AA standards');
    }

    if (metrics.performance.bundle_size_kb > 1500) {
      recommendations.push('Consider code splitting and bundle optimization to reduce size');
    }

    if (metrics.reliability.flaky_test_count > 2) {
      recommendations.push('Investigate and fix flaky tests to improve CI reliability');
    }

    return recommendations;
  }

  /**
   * Calculate overall quality status from gate results
   */
  static calculateOverallStatus(gateResults: QualityGateResult[]): 'PASS' | 'FAIL' | 'WARN' {
    const failures = gateResults.filter(g => g.status === 'FAIL' && g.required);
    const warnings = gateResults.filter(g => g.status === 'WARN' || (g.status === 'FAIL' && !g.required));

    if (failures.length > 0) {
      return 'FAIL';
    } else if (warnings.length > 0) {
      return 'WARN';
    } else {
      return 'PASS';
    }
  }

  /**
   * Validate quality gate configuration
   */
  static validateGateConfiguration(gate: any): string[] {
    const errors: string[] = [];

    if (!gate.name || typeof gate.name !== 'string') {
      errors.push('Quality gate must have a valid name');
    }

    if (!gate.phase || !['pre-commit', 'build', 'test', 'deploy', 'post-deploy'].includes(gate.phase)) {
      errors.push('Quality gate must have a valid phase');
    }

    if (typeof gate.timeout !== 'number' || gate.timeout <= 0) {
      errors.push('Quality gate timeout must be a positive number');
    }

    if (!Array.isArray(gate.criteria) || gate.criteria.length === 0) {
      errors.push('Quality gate must have at least one criterion');
    }

    return errors;
  }

  /**
   * Calculate quality trend direction
   */
  static calculateTrend(currentValue: number, previousValue: number): 'improving' | 'stable' | 'declining' {
    const changePercentage = Math.abs((currentValue - previousValue) / previousValue) * 100;
    
    // Consider changes less than 2% as stable
    if (changePercentage < 2) {
      return 'stable';
    }
    
    // For coverage and quality metrics, higher is better
    return currentValue > previousValue ? 'improving' : 'declining';
  }
}