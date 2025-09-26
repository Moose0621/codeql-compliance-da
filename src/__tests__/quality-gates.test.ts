import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QualityGateEvaluator, QUALITY_GATES, type QualityMetrics } from '../lib/quality-gates';

describe('QualityGateEvaluator', () => {
  let mockMetrics: QualityMetrics;
  let evaluator: QualityGateEvaluator;

  beforeEach(() => {
    mockMetrics = {
      test_coverage: {
        statements: 85,
        branches: 80,
        functions: 90,
        lines: 87,
        overall: 86
      },
      code_quality: {
        eslint_errors: 0,
        eslint_warnings: 3,
        typescript_errors: 0,
        complexity_score: 85,
        maintainability_index: 80
      },
      security: {
        critical_vulnerabilities: 0,
        high_vulnerabilities: 0,
        medium_vulnerabilities: 2,
        low_vulnerabilities: 1,
        dependency_vulnerabilities: 3
      },
      performance: {
        bundle_size_kb: 1500,
        load_time_ms: 1800,
        lighthouse_performance_score: 92,
        lighthouse_accessibility_score: 96,
        memory_usage_mb: 85
      },
      reliability: {
        test_pass_rate: 100,
        flaky_test_count: 1,
        error_rate: 0.05,
        mean_time_to_failure: 300
      }
    };

    evaluator = new QualityGateEvaluator(mockMetrics);
  });

  describe('Quality Gate Configuration', () => {
    it('should have all required quality gates defined', () => {
      expect(QUALITY_GATES).toHaveLength(6);
      
      const gateNames = QUALITY_GATES.map(gate => gate.name);
      expect(gateNames).toContain('Code Quality Gate');
      expect(gateNames).toContain('Functional Suitability Gate');
      expect(gateNames).toContain('Security Gate');
      expect(gateNames).toContain('Performance Gate');
      expect(gateNames).toContain('Accessibility Gate');
      expect(gateNames).toContain('Reliability Gate');
    });

    it('should have proper gate phase assignment', () => {
      const phases = QUALITY_GATES.map(gate => gate.phase);
      expect(phases).toContain('pre-commit');
      expect(phases).toContain('build');
      expect(phases).toContain('test');
      expect(phases).toContain('deploy');
      expect(phases).toContain('post-deploy');
    });

    it('should mark critical gates as required', () => {
      const criticalGates = ['Code Quality Gate', 'Functional Suitability Gate', 'Security Gate'];
      
      criticalGates.forEach(gateName => {
        const gate = QUALITY_GATES.find(g => g.name === gateName);
        expect(gate?.required).toBe(true);
      });
    });
  });

  describe('Code Quality Gate Evaluation', () => {
    it('should pass when code quality meets standards', () => {
      const codeQualityGate = QUALITY_GATES.find(g => g.name === 'Code Quality Gate')!;
      const result = evaluator.evaluateGate(codeQualityGate);

      expect(result.status).toBe('PASS');
      expect(result.criteria_results).toHaveLength(3);
      
      // All criteria should pass
      result.criteria_results.forEach(criteria => {
        expect(criteria.status).toBe('PASS');
      });
    });

    it('should fail when ESLint errors are present', () => {
      mockMetrics.code_quality.eslint_errors = 2;
      evaluator = new QualityGateEvaluator(mockMetrics);

      const codeQualityGate = QUALITY_GATES.find(g => g.name === 'Code Quality Gate')!;
      const result = evaluator.evaluateGate(codeQualityGate);

      expect(result.status).toBe('FAIL');
      
      const eslintErrorCriteria = result.criteria_results.find(c => c.metric === 'code_quality.eslint_errors');
      expect(eslintErrorCriteria?.status).toBe('FAIL');
    });

    it('should fail when TypeScript errors are present', () => {
      mockMetrics.code_quality.typescript_errors = 1;
      evaluator = new QualityGateEvaluator(mockMetrics);

      const codeQualityGate = QUALITY_GATES.find(g => g.name === 'Code Quality Gate')!;
      const result = evaluator.evaluateGate(codeQualityGate);

      expect(result.status).toBe('FAIL');
    });

    it('should warn when ESLint warnings exceed threshold', () => {
      mockMetrics.code_quality.eslint_warnings = 10;
      evaluator = new QualityGateEvaluator(mockMetrics);

      const codeQualityGate = QUALITY_GATES.find(g => g.name === 'Code Quality Gate')!;
      const result = evaluator.evaluateGate(codeQualityGate);

      expect(result.status).toBe('WARN');
    });
  });

  describe('Functional Suitability Gate Evaluation', () => {
    it('should pass when test coverage meets requirements', () => {
      mockMetrics.test_coverage.overall = 92;
      mockMetrics.test_coverage.statements = 90;
      mockMetrics.test_coverage.branches = 85;
      evaluator = new QualityGateEvaluator(mockMetrics);

      const functionalGate = QUALITY_GATES.find(g => g.name === 'Functional Suitability Gate')!;
      const result = evaluator.evaluateGate(functionalGate);

      expect(result.status).toBe('PASS');
    });

    it('should fail when overall coverage is below threshold', () => {
      mockMetrics.test_coverage.overall = 85; // Below 90% requirement
      evaluator = new QualityGateEvaluator(mockMetrics);

      const functionalGate = QUALITY_GATES.find(g => g.name === 'Functional Suitability Gate')!;
      const result = evaluator.evaluateGate(functionalGate);

      expect(result.status).toBe('FAIL');
    });

    it('should fail when test pass rate is not 100%', () => {
      mockMetrics.reliability.test_pass_rate = 95;
      evaluator = new QualityGateEvaluator(mockMetrics);

      const functionalGate = QUALITY_GATES.find(g => g.name === 'Functional Suitability Gate')!;
      const result = evaluator.evaluateGate(functionalGate);

      expect(result.status).toBe('FAIL');
    });
  });

  describe('Security Gate Evaluation', () => {
    it('should pass when no critical or high vulnerabilities exist', () => {
      const securityGate = QUALITY_GATES.find(g => g.name === 'Security Gate')!;
      const result = evaluator.evaluateGate(securityGate);

      expect(result.status).toBe('PASS');
    });

    it('should fail when critical vulnerabilities are present', () => {
      mockMetrics.security.critical_vulnerabilities = 1;
      evaluator = new QualityGateEvaluator(mockMetrics);

      const securityGate = QUALITY_GATES.find(g => g.name === 'Security Gate')!;
      const result = evaluator.evaluateGate(securityGate);

      expect(result.status).toBe('FAIL');
    });

    it('should fail when high vulnerabilities are present', () => {
      mockMetrics.security.high_vulnerabilities = 2;
      evaluator = new QualityGateEvaluator(mockMetrics);

      const securityGate = QUALITY_GATES.find(g => g.name === 'Security Gate')!;
      const result = evaluator.evaluateGate(securityGate);

      expect(result.status).toBe('FAIL');
    });

    it('should warn when too many dependency vulnerabilities exist', () => {
      mockMetrics.security.dependency_vulnerabilities = 10;
      evaluator = new QualityGateEvaluator(mockMetrics);

      const securityGate = QUALITY_GATES.find(g => g.name === 'Security Gate')!;
      const result = evaluator.evaluateGate(securityGate);

      expect(result.status).toBe('WARN');
    });
  });

  describe('Performance Gate Evaluation', () => {
    it('should pass when performance metrics meet requirements', () => {
      const performanceGate = QUALITY_GATES.find(g => g.name === 'Performance Gate')!;
      const result = evaluator.evaluateGate(performanceGate);

      expect(result.status).toBe('PASS');
    });

    it('should fail when bundle size exceeds limit', () => {
      mockMetrics.performance.bundle_size_kb = 3000; // Above 2MB limit
      evaluator = new QualityGateEvaluator(mockMetrics);

      const performanceGate = QUALITY_GATES.find(g => g.name === 'Performance Gate')!;
      const result = evaluator.evaluateGate(performanceGate);

      expect(result.status).toBe('WARN');
    });

    it('should fail when load time exceeds threshold', () => {
      mockMetrics.performance.load_time_ms = 3000; // Above 2s limit
      evaluator = new QualityGateEvaluator(mockMetrics);

      const performanceGate = QUALITY_GATES.find(g => g.name === 'Performance Gate')!;
      const result = evaluator.evaluateGate(performanceGate);

      expect(result.status).toBe('FAIL');
    });

    it('should fail when Lighthouse performance score is low', () => {
      mockMetrics.performance.lighthouse_performance_score = 80; // Below 90 requirement
      evaluator = new QualityGateEvaluator(mockMetrics);

      const performanceGate = QUALITY_GATES.find(g => g.name === 'Performance Gate')!;
      const result = evaluator.evaluateGate(performanceGate);

      expect(result.status).toBe('WARN');
    });
  });

  describe('Accessibility Gate Evaluation', () => {
    it('should pass when accessibility score meets WCAG requirements', () => {
      const accessibilityGate = QUALITY_GATES.find(g => g.name === 'Accessibility Gate')!;
      const result = evaluator.evaluateGate(accessibilityGate);

      expect(result.status).toBe('PASS');
    });

    it('should fail when accessibility score is below WCAG 2.1 AA threshold', () => {
      mockMetrics.performance.lighthouse_accessibility_score = 90; // Below 95 requirement
      evaluator = new QualityGateEvaluator(mockMetrics);

      const accessibilityGate = QUALITY_GATES.find(g => g.name === 'Accessibility Gate')!;
      const result = evaluator.evaluateGate(accessibilityGate);

      expect(result.status).toBe('FAIL');
    });
  });

  describe('Phase-based Gate Evaluation', () => {
    it('should evaluate all gates for pre-commit phase', () => {
      const preCommitResults = evaluator.evaluatePhase('pre-commit');
      
      expect(preCommitResults).toHaveLength(1);
      expect(preCommitResults[0].gate_name).toBe('Code Quality Gate');
    });

    it('should evaluate all gates for test phase', () => {
      const testResults = evaluator.evaluatePhase('test');
      
      expect(testResults).toHaveLength(1);
      expect(testResults[0].gate_name).toBe('Functional Suitability Gate');
    });

    it('should evaluate all gates for build phase', () => {
      const buildResults = evaluator.evaluatePhase('build');
      
      expect(buildResults).toHaveLength(1);
      expect(buildResults[0].gate_name).toBe('Security Gate');
    });

    it('should evaluate all gates for deploy phase', () => {
      const deployResults = evaluator.evaluatePhase('deploy');
      
      expect(deployResults).toHaveLength(2);
      const gateNames = deployResults.map(r => r.gate_name);
      expect(gateNames).toContain('Performance Gate');
      expect(gateNames).toContain('Accessibility Gate');
    });
  });

  describe('Metric Value Extraction', () => {
    it('should extract nested metric values correctly', () => {
      const result = evaluator['getMetricValue']('test_coverage.overall');
      expect(result).toBe(86);
    });

    it('should extract top-level metric values correctly', () => {
      const result = evaluator['getMetricValue']('code_quality.eslint_errors');
      expect(result).toBe(0);
    });

    it('should throw error for invalid metric paths', () => {
      expect(() => {
        evaluator['getMetricValue']('invalid.path.here');
      }).toThrow('Metric path not found: invalid.path.here');
    });
  });

  describe('Comparison Operations', () => {
    it('should correctly compare greater than values', () => {
      expect(evaluator['compareValues'](95, 90, 'greater_than')).toBe(true);
      expect(evaluator['compareValues'](85, 90, 'greater_than')).toBe(false);
    });

    it('should correctly compare less than values', () => {
      expect(evaluator['compareValues'](5, 10, 'less_than')).toBe(true);
      expect(evaluator['compareValues'](15, 10, 'less_than')).toBe(false);
    });

    it('should correctly compare equal values', () => {
      expect(evaluator['compareValues'](10, 10, 'equals')).toBe(true);
      expect(evaluator['compareValues'](10, 5, 'equals')).toBe(false);
    });

    it('should correctly compare string contains', () => {
      expect(evaluator['compareValues']('hello world', 'hello', 'contains')).toBe(true);
      expect(evaluator['compareValues']('hello world', 'xyz', 'contains')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing metrics gracefully', () => {
      const incompleteMetrics = {
        test_coverage: {
          statements: 85,
          branches: 80,
          functions: 90,
          lines: 87,
          overall: 86
        }
      } as any;

      expect(() => {
        new QualityGateEvaluator(incompleteMetrics);
      }).not.toThrow();
    });

    it('should provide meaningful error messages', () => {
      const codeQualityGate = QUALITY_GATES.find(g => g.name === 'Code Quality Gate')!;
      const result = evaluator.evaluateGate(codeQualityGate);

      result.criteria_results.forEach(criteria => {
        expect(criteria.message).toContain(criteria.metric);
        expect(criteria.message).toContain(criteria.status);
      });
    });
  });

  describe('Result Structure Validation', () => {
    it('should return complete quality gate results', () => {
      const codeQualityGate = QUALITY_GATES.find(g => g.name === 'Code Quality Gate')!;
      const result = evaluator.evaluateGate(codeQualityGate);

      expect(result).toHaveProperty('gate_name');
      expect(result).toHaveProperty('phase');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('required');
      expect(result).toHaveProperty('criteria_results');
      expect(result).toHaveProperty('evaluated_at');

      expect(Array.isArray(result.criteria_results)).toBe(true);
      expect(result.criteria_results.length).toBeGreaterThan(0);
    });

    it('should include all required criteria result fields', () => {
      const codeQualityGate = QUALITY_GATES.find(g => g.name === 'Code Quality Gate')!;
      const result = evaluator.evaluateGate(codeQualityGate);

      result.criteria_results.forEach(criteria => {
        expect(criteria).toHaveProperty('metric');
        expect(criteria).toHaveProperty('expected');
        expect(criteria).toHaveProperty('actual');
        expect(criteria).toHaveProperty('comparison');
        expect(criteria).toHaveProperty('status');
        expect(criteria).toHaveProperty('severity');
        expect(criteria).toHaveProperty('message');
      });
    });
  });
});