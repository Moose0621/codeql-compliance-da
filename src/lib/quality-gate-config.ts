/**
 * Environment-specific Quality Gate Configuration
 * Allows for graduated quality thresholds across different environments
 */

import type { QualityGate } from './quality-gates';

export interface EnvironmentConfig {
  name: string;
  description: string;
  strictMode: boolean;
  enabledGates: string[];
  customThresholds?: Record<string, any>;
}

/**
 * Development Environment - Relaxed thresholds for rapid iteration
 */
export const DEVELOPMENT_CONFIG: EnvironmentConfig = {
  name: 'development',
  description: 'Development environment with relaxed quality thresholds',
  strictMode: false,
  enabledGates: ['Code Quality Gate'],
  customThresholds: {
    'test_coverage.overall': 75,
    'code_quality.eslint_warnings': 10,
    'security.dependency_vulnerabilities': 10
  }
};

/**
 * Staging Environment - Moderate thresholds for pre-production validation
 */
export const STAGING_CONFIG: EnvironmentConfig = {
  name: 'staging',
  description: 'Staging environment with moderate quality requirements',
  strictMode: true,
  enabledGates: [
    'Code Quality Gate',
    'Functional Suitability Gate',
    'Security Gate',
    'Performance Gate'
  ],
  customThresholds: {
    'test_coverage.overall': 80,
    'performance.lighthouse_performance_score': 85,
    'performance.bundle_size_kb': 2500
  }
};

/**
 * Production Environment - Strict thresholds for production deployment
 */
export const PRODUCTION_CONFIG: EnvironmentConfig = {
  name: 'production',
  description: 'Production environment with strict quality requirements',
  strictMode: true,
  enabledGates: [
    'Code Quality Gate',
    'Functional Suitability Gate',
    'Security Gate',
    'Performance Gate',
    'Accessibility Gate',
    'Reliability Gate'
  ],
  customThresholds: {
    'test_coverage.overall': 85, // Start at 85%, target 90%
    'performance.lighthouse_performance_score': 90,
    'performance.lighthouse_accessibility_score': 95,
    'security.critical_vulnerabilities': 0,
    'security.high_vulnerabilities': 0
  }
};

/**
 * Create environment-specific quality gates
 */
export function createEnvironmentGates(
  baseGates: QualityGate[],
  envConfig: EnvironmentConfig
): QualityGate[] {
  return baseGates
    .filter(gate => envConfig.enabledGates.includes(gate.name))
    .map(gate => {
      if (!envConfig.customThresholds) return gate;

      // Apply custom thresholds to criteria
      const updatedCriteria = gate.criteria.map(criteria => {
        const customThreshold = envConfig.customThresholds![criteria.metric];
        if (customThreshold !== undefined) {
          return {
            ...criteria,
            threshold: customThreshold
          };
        }
        return criteria;
      });

      return {
        ...gate,
        criteria: updatedCriteria
      };
    });
}

/**
 * Get quality gate configuration for current environment
 */
export function getQualityGateConfiguration(): EnvironmentConfig {
  const environment = process.env.NODE_ENV || 'development';
  
  switch (environment) {
    case 'production':
      return PRODUCTION_CONFIG;
    case 'staging':
    case 'test':
      return STAGING_CONFIG;
    case 'development':
    default:
      return DEVELOPMENT_CONFIG;
  }
}

/**
 * Quality Gate Graduation Strategy
 * Gradually increase quality requirements over time
 */
export interface GraduationMilestone {
  version: string;
  date: string;
  thresholds: Record<string, number>;
  description: string;
}

export const QUALITY_GRADUATION_ROADMAP: GraduationMilestone[] = [
  {
    version: '1.0.0',
    date: '2024-01-01',
    thresholds: {
      'test_coverage.overall': 75
    },
    description: 'Initial quality baseline'
  },
  {
    version: '1.1.0',
    date: '2024-02-01',
    thresholds: {
      'test_coverage.overall': 80,
      'performance.lighthouse_performance_score': 85
    },
    description: 'Performance optimization focus'
  },
  {
    version: '1.2.0',
    date: '2024-03-01',
    thresholds: {
      'test_coverage.overall': 85,
      'performance.lighthouse_performance_score': 90,
      'performance.lighthouse_accessibility_score': 95
    },
    description: 'Quality and accessibility improvements'
  },
  {
    version: '2.0.0',
    date: '2024-04-01',
    thresholds: {
      'test_coverage.overall': 90,
      'performance.lighthouse_performance_score': 92,
      'performance.lighthouse_accessibility_score': 98
    },
    description: 'Enterprise-grade quality standards'
  }
];

/**
 * Get appropriate quality thresholds based on current date
 */
export function getCurrentQualityMilestone(): GraduationMilestone {
  const currentDate = new Date();
  
  // Find the most recent milestone that has passed
  const applicableMilestone = QUALITY_GRADUATION_ROADMAP
    .filter(milestone => new Date(milestone.date) <= currentDate)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  
  return applicableMilestone || QUALITY_GRADUATION_ROADMAP[0];
}