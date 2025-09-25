/**
 * GitHub Workflow Dispatch Permission Checker
 * 
 * Provides pre-flight validation for workflow dispatch operations to give
 * actionable error messages when permissions are insufficient.
 */

/**
 * Pre-flight check to validate if workflow dispatch is possible
 * @param repo Repository in format "owner/repo"
 * @param token GitHub token
 * @param workflowFile Optional workflow filename to check specifically
 * @throws {Error} With specific error message and suggestions
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
      throw new Error(
        '403 listing workflows – token likely missing workflow/actions scope. ' +
        'Verify your token has the "workflow" scope (classic PAT) or "Actions: Read and write" permission (fine-grained PAT). ' +
        'If using an organization token, ensure it\'s authorized for SSO. ' +
        'Check that repository Actions are enabled in Settings > Actions > General.'
      );
    }

    if (workflowsResponse.status === 404) {
      throw new Error(
        `Repository ${repo} not found or not accessible. ` +
        'Verify the repository name is correct and that your token has access to this repository.'
      );
    }

    if (!workflowsResponse.ok) {
      throw new Error(`Failed listing workflows (${workflowsResponse.status}). Check GitHub API status and try again.`);
    }

    const workflowsData = await workflowsResponse.json();
    
    // Step 2: If checking for a specific workflow file, validate it exists
    if (workflowFile) {
      const targetWorkflow = workflowsData.workflows?.find((w: any) => 
        w.path.endsWith(`/${workflowFile}`) || w.name.toLowerCase().includes('codeql')
      );

      if (!targetWorkflow) {
        throw new Error(
          `Workflow ${workflowFile} not found on default branch. ` +
          `Ensure the workflow file exists at .github/workflows/${workflowFile} and is committed to the default branch.`
        );
      }
    }

    // If we get here, basic permissions are sufficient for workflow listing
    // Actual dispatch errors will be handled by the enhanced dispatchWorkflow method
  } catch (error) {
    // Handle network or other unexpected errors
    if (error instanceof Error && (error.message.includes('403') || error.message.includes('404') || error.message.includes('not found'))) {
      throw error; // Re-throw our specific errors
    }
    
    throw new Error(`Network error during workflow dispatch check: ${error instanceof Error ? error.message : String(error)}. Check network connectivity and GitHub API status.`);
  }
}