import { GitHubService } from './github-service';

export interface WorkflowCapabilities {
  hasCodeQLWorkflow: boolean;
  supportsWorkflowDispatch: boolean;
  workflowType: 'default-setup' | 'advanced-setup' | 'none';
  canTriggerOnDemand: boolean;
  recommendations: string[];
}

/**
 * Analyzes a repository's CodeQL setup and provides recommendations
 * for enabling on-demand scanning capabilities.
 */
export async function analyzeCodeQLCapabilities(
  githubService: GitHubService,
  repoName: string
): Promise<WorkflowCapabilities> {
  const result: WorkflowCapabilities = {
    hasCodeQLWorkflow: false,
    supportsWorkflowDispatch: false,
    workflowType: 'none',
    canTriggerOnDemand: false,
    recommendations: []
  };

  try {
    // Get all workflows
    const workflows = await githubService.getWorkflows(repoName);
    const codeqlWorkflows = workflows.filter(workflow =>
      workflow.name?.toLowerCase().includes('codeql') ||
      workflow.path?.includes('codeql')
    );

    if (codeqlWorkflows.length === 0) {
      result.workflowType = 'none';
      result.recommendations.push(
        'No CodeQL workflow detected. Consider enabling GitHub\'s Default Setup or creating an Advanced Setup workflow.',
        'Default Setup: Repository Settings → Security → Code security and analysis → CodeQL analysis',
        'Advanced Setup: Add .github/workflows/codeql-advanced.yml to your repository'
      );
      return result;
    }

    result.hasCodeQLWorkflow = true;

    // Check if any workflow supports workflow_dispatch
    // Note: We can't directly check the workflow content via API, but we can make educated guesses
    const advancedWorkflows = codeqlWorkflows.filter(workflow =>
      workflow.path !== '.github/workflows/codeql.yml' && // GitHub's default setup path
      (workflow.path.includes('advanced') || 
       workflow.path.includes('dispatch') ||
       workflow.name?.toLowerCase().includes('advanced'))
    );

    if (advancedWorkflows.length > 0) {
      result.workflowType = 'advanced-setup';
      result.supportsWorkflowDispatch = true; // Assumption - advanced workflows usually support dispatch
      result.canTriggerOnDemand = true;
      result.recommendations.push(
        'Advanced CodeQL workflow detected. On-demand scanning should be available.',
        'Verify workflow_dispatch trigger is configured in the workflow file.',
        'Test on-demand scanning through the dashboard or GitHub Actions tab.'
      );
    } else {
      // Likely default setup or basic workflow
      result.workflowType = 'default-setup';
      result.supportsWorkflowDispatch = false;
      result.canTriggerOnDemand = false;
      result.recommendations.push(
        'Default CodeQL setup detected. This doesn\'t support on-demand scanning.',
        'To enable on-demand scanning, you need to switch to Advanced Setup:',
        '1. Disable Default Setup in repository settings',
        '2. Add .github/workflows/codeql-advanced.yml to your repository',
        '3. Configure the workflow with workflow_dispatch trigger',
        '4. Update repository permissions to allow workflow dispatch'
      );
    }

    // Additional checks and recommendations
    if (result.canTriggerOnDemand) {
      // Test if we can actually dispatch (this will help identify permission issues)
      try {
        const workflowId = await githubService.findCodeQLWorkflow(repoName);
        if (!workflowId) {
          result.canTriggerOnDemand = false;
          result.recommendations.push('Warning: CodeQL workflow found but cannot be identified for dispatch.');
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('403')) {
          result.canTriggerOnDemand = false;
          result.recommendations.push(
            'Permission issue detected: Cannot dispatch workflows.',
            'Ensure your token has "workflow" scope (classic PAT) or "Actions: Read and write" (fine-grained PAT).',
            'Check repository Actions settings: Settings → Actions → General → Workflow permissions'
          );
        }
      }
    }

  } catch (error) {
    result.recommendations.push(
      'Error analyzing repository capabilities: ' + (error instanceof Error ? error.message : String(error)),
      'Please check your GitHub token permissions and repository access.'
    );
  }

  return result;
}

/**
 * Provides specific migration guidance based on current setup
 */
export function generateMigrationPlan(capabilities: WorkflowCapabilities): {
  priority: 'low' | 'medium' | 'high';
  steps: string[];
  timeline: string;
  risks: string[];
} {
  if (capabilities.canTriggerOnDemand) {
    return {
      priority: 'low',
      steps: ['Setup is already optimal for on-demand scanning'],
      timeline: 'No migration needed',
      risks: []
    };
  }

  if (capabilities.workflowType === 'none') {
    return {
      priority: 'high',
      steps: [
        'Choose between Default Setup (automatic) or Advanced Setup (on-demand capable)',
        'For on-demand scanning: Copy codeql-advanced.yml template to .github/workflows/',
        'Configure languages and triggers in the workflow file',
        'Test the workflow by triggering it manually',
        'Update repository permissions if needed'
      ],
      timeline: '1-2 hours for setup and testing',
      risks: ['No current security scanning - high priority to implement']
    };
  }

  // Default setup migration
  return {
    priority: 'medium',
    steps: [
      'Backup current Default Setup configuration (note languages and frequency)',
      'Disable Default Setup in repository settings',
      'Add Advanced Setup workflow (.github/workflows/codeql-advanced.yml)',
      'Configure workflow with same languages as Default Setup',
      'Add workflow_dispatch trigger for on-demand scanning',
      'Test both scheduled and on-demand scanning',
      'Monitor for any differences in scan results'
    ],
    timeline: '2-4 hours including testing and validation',
    risks: [
      'Brief gap in automatic scanning during migration',
      'May need to adjust build configurations for compiled languages',
      'Potential differences in scan results between Default and Advanced setup'
    ]
  };
}

/**
 * Validates that on-demand scanning is properly configured
 */
export async function validateOnDemandScanning(
  githubService: GitHubService,
  repoName: string
): Promise<{
  isValid: boolean;
  issues: string[];
  suggestions: string[];
}> {
  const issues: string[] = [];
  const suggestions: string[] = [];

  try {
    // Check if we can find a dispatchable workflow
    const workflowId = await githubService.findCodeQLWorkflow(repoName);
    if (!workflowId) {
      issues.push('No CodeQL workflow found or workflow not dispatchable');
      suggestions.push('Ensure .github/workflows/codeql-advanced.yml exists with workflow_dispatch trigger');
    }

    // Try to get recent workflow runs to check if scanning is working
    const runs = await githubService.getWorkflowRuns(repoName, 'codeql', 1, 5);
    if (runs.length === 0) {
      suggestions.push('No recent CodeQL runs found - consider running a test scan');
    } else {
      const latestRun = runs[0];
      if (latestRun.status === 'failure' || latestRun.conclusion === 'failure') {
        issues.push('Latest CodeQL workflow run failed');
        suggestions.push('Check workflow logs for build or configuration issues');
      }
    }

    // Check security findings endpoint (validates that code scanning is properly set up)
    const findings = await githubService.getSecurityFindings(repoName);
    if (findings.total === 0) {
      suggestions.push('No security findings detected - this could indicate successful security or insufficient scan coverage');
    }

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('403')) {
        issues.push('Permission denied - token lacks necessary scopes');
        suggestions.push('Ensure token has "workflow" scope and repository Actions are enabled');
      } else if (error.message.includes('404')) {
        issues.push('Repository or workflow not found');
        suggestions.push('Verify repository exists and you have access');
      } else {
        issues.push(`Validation error: ${error.message}`);
      }
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions
  };
}