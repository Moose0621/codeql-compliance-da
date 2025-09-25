/**
 * GitHub Workflow Dispatch Permission Checker
 * 
 * Provides pre-flight validation for workflow dispatch operations to give
 * actionable error messages when permissions are insufficient.
 */

export interface WorkflowDispatchError extends Error {
  code: 'MISSING_WORKFLOW' | 'INSUFFICIENT_PERMISSIONS' | 'WORKFLOW_NOT_DISPATCHABLE' | 'UNKNOWN_ERROR';
  suggestions: string[];
}

/**
 * Pre-flight check to validate if workflow dispatch is possible
 * @param repo Repository in format "owner/repo"
 * @param token GitHub token
 * @param workflowFile Optional workflow filename to check specifically
 * @throws {WorkflowDispatchError} With specific error code and suggestions
 */
export async function assertWorkflowDispatchable(repo: string, token: string, workflowFile?: string): Promise<void> {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };

  try {
    // Step 1: Check if we can list workflows (tests basic repo and actions read permissions)
    const workflowsResponse = await fetch(`https://api.github.com/repos/${repo}/actions/workflows`, { headers });
    
    if (workflowsResponse.status === 403) {
      const errorBody = await workflowsResponse.text().catch(() => '');
      const error = new Error('403 listing workflows – token likely missing workflow/actions scope') as WorkflowDispatchError;
      error.code = 'INSUFFICIENT_PERMISSIONS';
      error.suggestions = [
        'Verify your token has the "workflow" scope (classic PAT) or "Actions: Read and write" permission (fine-grained PAT)',
        'If using an organization token, ensure it\'s authorized for SSO',
        'Check that repository Actions are enabled in Settings > Actions > General'
      ];
      throw error;
    }

    if (workflowsResponse.status === 404) {
      const error = new Error(`Repository ${repo} not found or not accessible`) as WorkflowDispatchError;
      error.code = 'INSUFFICIENT_PERMISSIONS';
      error.suggestions = [
        'Verify the repository name is correct',
        'Check that your token has access to this repository',
        'Ensure the repository exists and is not private (unless token has appropriate access)'
      ];
      throw error;
    }

    if (!workflowsResponse.ok) {
      const error = new Error(`Failed listing workflows (${workflowsResponse.status})`) as WorkflowDispatchError;
      error.code = 'UNKNOWN_ERROR';
      error.suggestions = ['Check GitHub API status and try again'];
      throw error;
    }

    const workflowsData = await workflowsResponse.json();
    
    // Step 2: If checking for a specific workflow file, validate it exists
    if (workflowFile) {
      const targetWorkflow = workflowsData.workflows?.find((w: any) => 
        w.path.endsWith(`/${workflowFile}`) || w.name.toLowerCase().includes('codeql')
      );

      if (!targetWorkflow) {
        const error = new Error(`Workflow ${workflowFile} not found on default branch`) as WorkflowDispatchError;
        error.code = 'MISSING_WORKFLOW';
        error.suggestions = [
          `Ensure the workflow file exists at .github/workflows/${workflowFile}`,
          'Verify the workflow is committed to the default branch',
          'Check that the workflow file has valid YAML syntax'
        ];
        throw error;
      }
    }

    // If we get here, basic permissions are sufficient for workflow listing
    // Actual dispatch errors will be handled by the enhanced dispatchWorkflow method
  } catch (error) {
    if ((error as WorkflowDispatchError).code) {
      throw error; // Re-throw our typed errors
    }
    
    // Handle network or other unexpected errors
    const dispatchError = new Error(`Network error during workflow dispatch check: ${error instanceof Error ? error.message : String(error)}`) as WorkflowDispatchError;
    dispatchError.code = 'UNKNOWN_ERROR';
    dispatchError.suggestions = ['Check network connectivity and GitHub API status'];
    throw dispatchError;
  }
}