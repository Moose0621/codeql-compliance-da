/**
 * Quality Gates Configuration for CI/CD Pipeline
 * Implements ISO 25010 quality model with ISTQB-compliant validation
 */

export interface QualityGate {
  name: string;
  phase: 'pre-commit' | 'build' | 'test' | 'deploy' | 'post-deploy';
  criteria: QualityCriteria[];
  required: boolean;
  timeout: number; // in milliseconds
}

export interface QualityCriteria {
  metric: string;
  threshold: number | string;
  comparison: 'greater_than' | 'less_than' | 'equals' | 'not_equals' | 'contains';
  severity: 'blocker' | 'critical' | 'major' | 'minor' | 'info';
}

export interface QualityMetrics {
  test_coverage: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
    overall: number;
  };
  code_quality: {
    eslint_errors: number;
    eslint_warnings: number;
    typescript_errors: number;
    complexity_score: number;
    maintainability_index: number;
  };
  security: {
    critical_vulnerabilities: number;
    high_vulnerabilities: number;
    medium_vulnerabilities: number;
    low_vulnerabilities: number;
    dependency_vulnerabilities: number;
  };
  performance: {
    bundle_size_kb: number;
    load_time_ms: number;
    lighthouse_performance_score: number;
    lighthouse_accessibility_score: number;
    memory_usage_mb: number;
  };
  reliability: {
    test_pass_rate: number;
    flaky_test_count: number;
    error_rate: number;
    mean_time_to_failure: number;
  };
}

/**
 * Quality Gates Configuration following ISO 25010 Quality Model
 */
export const QUALITY_GATES: QualityGate[] = [
  // Gate 1: Code Quality (Pre-commit)
  {
    name: 'Code Quality Gate',
    phase: 'pre-commit',
    required: true,
    timeout: 30000, // 30 seconds
    criteria: [
      {
        metric: 'code_quality.eslint_errors',
        threshold: 0,
        comparison: 'equals',
        severity: 'blocker'
      },
      {
        metric: 'code_quality.typescript_errors',
        threshold: 0,
        comparison: 'equals',
        severity: 'blocker'
      },
      {
        metric: 'code_quality.eslint_warnings',
        threshold: 5,
        comparison: 'less_than',
        severity: 'major'
      }
    ]
  },

  // Gate 2: Functional Suitability (Build/Test)
  {
    name: 'Functional Suitability Gate',
    phase: 'test',
    required: true,
    timeout: 300000, // 5 minutes
    criteria: [
      {
        metric: 'test_coverage.overall',
        threshold: 90,
        comparison: 'greater_than',
        severity: 'critical'
      },
      {
        metric: 'reliability.test_pass_rate',
        threshold: 100,
        comparison: 'equals',
        severity: 'blocker'
      },
      {
        metric: 'test_coverage.statements',
        threshold: 85,
        comparison: 'greater_than',
        severity: 'major'
      },
      {
        metric: 'test_coverage.branches',
        threshold: 80,
        comparison: 'greater_than',
        severity: 'major'
      }
    ]
  },

  // Gate 3: Security (Build)
  {
    name: 'Security Gate',
    phase: 'build',
    required: true,
    timeout: 180000, // 3 minutes
    criteria: [
      {
        metric: 'security.critical_vulnerabilities',
        threshold: 0,
        comparison: 'equals',
        severity: 'blocker'
      },
      {
        metric: 'security.high_vulnerabilities',
        threshold: 0,
        comparison: 'equals',
        severity: 'critical'
      },
      {
        metric: 'security.dependency_vulnerabilities',
        threshold: 5,
        comparison: 'less_than',
        severity: 'major'
      }
    ]
  },

  // Gate 4: Performance Efficiency (Deploy)
  {
    name: 'Performance Gate',
    phase: 'deploy',
    required: true,
    timeout: 600000, // 10 minutes
    criteria: [
      {
        metric: 'performance.bundle_size_kb',
        threshold: 2048, // 2MB limit
        comparison: 'less_than',
        severity: 'major'
      },
      {
        metric: 'performance.lighthouse_performance_score',
        threshold: 90,
        comparison: 'greater_than',
        severity: 'major'
      },
      {
        metric: 'performance.load_time_ms',
        threshold: 2000, // 2 seconds
        comparison: 'less_than',
        severity: 'critical'
      }
    ]
  },

  // Gate 5: Accessibility & Usability (Deploy)
  {
    name: 'Accessibility Gate',
    phase: 'deploy',
    required: true,
    timeout: 300000, // 5 minutes
    criteria: [
      {
        metric: 'performance.lighthouse_accessibility_score',
        threshold: 95,
        comparison: 'greater_than',
        severity: 'critical'
      }
    ]
  },

  // Gate 6: Reliability (Post-deploy)
  {
    name: 'Reliability Gate',
    phase: 'post-deploy',
    required: false,
    timeout: 600000, // 10 minutes
    criteria: [
      {
        metric: 'reliability.error_rate',
        threshold: 0.1, // 0.1% error rate
        comparison: 'less_than',
        severity: 'major'
      },
      {
        metric: 'reliability.flaky_test_count',
        threshold: 2,
        comparison: 'less_than',
        severity: 'minor'
      }
    ]
  }
];

/**
 * Quality Gate Evaluation Engine
 */
export class QualityGateEvaluator {
  private metrics: QualityMetrics;
  
  constructor(metrics: QualityMetrics) {
    this.metrics = metrics;
  }

  /**
   * Evaluate a specific quality gate
   */
  evaluateGate(gate: QualityGate): QualityGateResult {
    const results: CriteriaResult[] = [];
    let overallStatus: 'PASS' | 'FAIL' | 'WARN' = 'PASS';

    for (const criteria of gate.criteria) {
      const result = this.evaluateCriteria(criteria);
      results.push(result);

      // Determine overall gate status
      if (result.status === 'FAIL' && 
          (criteria.severity === 'blocker' || criteria.severity === 'critical')) {
        overallStatus = 'FAIL';
      } else if (result.status === 'FAIL' && overallStatus !== 'FAIL') {
        overallStatus = 'WARN';
      }
    }

    return {
      gate_name: gate.name,
      phase: gate.phase,
      status: overallStatus,
      required: gate.required,
      criteria_results: results,
      evaluated_at: new Date().toISOString()
    };
  }

  /**
   * Evaluate all quality gates for a specific phase
   */
  evaluatePhase(phase: QualityGate['phase']): QualityGateResult[] {
    return QUALITY_GATES
      .filter(gate => gate.phase === phase)
      .map(gate => this.evaluateGate(gate));
  }

  /**
   * Evaluate individual criteria
   */
  private evaluateCriteria(criteria: QualityCriteria): CriteriaResult {
    const actualValue = this.getMetricValue(criteria.metric);
    const passed = this.compareValues(actualValue, criteria.threshold, criteria.comparison);

    return {
      metric: criteria.metric,
      expected: criteria.threshold,
      actual: actualValue,
      comparison: criteria.comparison,
      status: passed ? 'PASS' : 'FAIL',
      severity: criteria.severity,
      message: this.generateMessage(criteria, actualValue, passed)
    };
  }

  /**
   * Get metric value from nested object path
   */
  private getMetricValue(metricPath: string): number | string {
    const path = metricPath.split('.');
    let value: any = this.metrics;

    for (const key of path) {
      value = value[key];
      if (value === undefined) {
        throw new Error(`Metric path not found: ${metricPath}`);
      }
    }

    return value;
  }

  /**
   * Compare actual value with threshold
   */
  private compareValues(
    actual: number | string, 
    expected: number | string, 
    comparison: QualityCriteria['comparison']
  ): boolean {
    switch (comparison) {
      case 'greater_than':
        return Number(actual) > Number(expected);
      case 'less_than':
        return Number(actual) < Number(expected);
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'contains':
        return String(actual).includes(String(expected));
      default:
        throw new Error(`Unknown comparison operator: ${comparison}`);
    }
  }

  /**
   * Generate human-readable message for criteria result
   */
  private generateMessage(
    criteria: QualityCriteria, 
    actualValue: number | string, 
    passed: boolean
  ): string {
    const status = passed ? 'PASSED' : 'FAILED';
    const operator = this.getOperatorSymbol(criteria.comparison);
    
    return `${criteria.metric} ${status}: ${actualValue} ${operator} ${criteria.threshold}`;
  }

  private getOperatorSymbol(comparison: QualityCriteria['comparison']): string {
    const symbols = {
      'greater_than': '>',
      'less_than': '<',
      'equals': '===',
      'not_equals': '!==',
      'contains': 'contains'
    };
    return symbols[comparison];
  }
}

export interface QualityGateResult {
  gate_name: string;
  phase: QualityGate['phase'];
  status: 'PASS' | 'FAIL' | 'WARN';
  required: boolean;
  criteria_results: CriteriaResult[];
  evaluated_at: string;
}

export interface CriteriaResult {
  metric: string;
  expected: number | string;
  actual: number | string;
  comparison: QualityCriteria['comparison'];
  status: 'PASS' | 'FAIL';
  severity: QualityCriteria['severity'];
  message: string;
}

/**
 * Quality Gate Configuration for different environments
 */
export const ENVIRONMENT_QUALITY_GATES = {
  development: {
    enabled: true,
    gates: ['Code Quality Gate'],
    strict_mode: false
  },
  
  staging: {
    enabled: true,
    gates: ['Code Quality Gate', 'Functional Suitability Gate', 'Security Gate'],
    strict_mode: true
  },
  
  production: {
    enabled: true,
    gates: QUALITY_GATES.map(g => g.name),
    strict_mode: true,
    additional_validations: [
      'smoke_tests',
      'performance_monitoring',
      'error_rate_monitoring'
    ]
  }
};