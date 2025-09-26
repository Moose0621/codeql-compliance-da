# CodeQL On-Demand Scanning Setup Guide

This guide explains how to enable on-demand CodeQL scanning for customers who need workflow dispatch capabilities.

## Problem Statement

GitHub CodeQL has two modes that are mutually exclusive:

1. **Default Setup** - Automatic, managed by GitHub
   - ✅ Zero configuration
   - ✅ Automatic language detection
   - ❌ No `workflow_dispatch` support
   - ❌ Limited customization

2. **Advanced Setup** - Custom workflows
   - ✅ Full control and customization
   - ✅ `workflow_dispatch` support
   - ✅ Custom queries and configurations
   - ❌ Requires manual setup per repository

## Recommended Solutions

### Option 1: Switch to Advanced Setup (Recommended)

**Best for:** Organizations needing on-demand scans with full control

1. **Disable Default Setup:**
   ```
   Repository Settings → Security → Code security and analysis → CodeQL analysis
   → Disable "Default setup"
   ```

2. **Add Advanced Workflow:**
   - Copy `.github/workflows/codeql-advanced.yml` to target repositories
   - Customize languages and triggers as needed
   - Enable workflow permissions

3. **Configure Repository Permissions:**
   ```
   Repository Settings → Actions → General → Workflow permissions
   → "Read and write permissions"
   ```

4. **Update Dashboard Integration:**
   - The existing dashboard will automatically detect the new workflow
   - On-demand scans will work through `workflow_dispatch`

### Option 2: API-Based Scanning

**Best for:** Centralized management with existing Default Setup

Create a separate scanning service that uses GitHub's REST API:

```javascript
// Example: Trigger scans via GitHub API
async function triggerCodeQLScan(repo, ref = 'main') {
  // 1. Create a branch for scanning
  const scanBranch = `codeql-scan-${Date.now()}`;
  await createBranch(repo, scanBranch, ref);
  
  // 2. Add temporary workflow to the branch
  await addWorkflowFile(repo, scanBranch, codeqlWorkflowContent);
  
  // 3. Trigger the workflow
  await dispatchWorkflow(repo, 'codeql.yml', scanBranch);
  
  // 4. Clean up branch after completion (optional)
  setTimeout(() => deleteBranch(repo, scanBranch), 3600000); // 1 hour
}
```

### Option 3: Hybrid Approach (Enterprise)

**Best for:** Large organizations with mixed needs

1. **Keep Default Setup** for baseline security
2. **Add Advanced Workflow** for on-demand scans
3. **Use different file paths** to avoid conflicts:
   - Default: Managed by GitHub
   - Advanced: `.github/workflows/codeql-ondemand.yml`

## Implementation Steps

### Step 1: Update Dashboard Configuration

Update the dashboard to handle both modes:

```typescript
// In github-service.ts
async findCodeQLWorkflow(repoName: string): Promise<number | null> {
  const workflows = await this.getWorkflows(repoName);
  
  // Look for advanced CodeQL workflow first
  const advancedWorkflow = workflows.find(w =>
    (w.name?.toLowerCase().includes('codeql') || w.path?.includes('codeql')) &&
    w.path !== '.github/workflows/codeql.yml' // Avoid default setup conflicts
  );
  
  if (advancedWorkflow) return advancedWorkflow.id;
  
  // Fallback to any CodeQL workflow
  const anyCodeQL = workflows.find(w =>
    w.name?.toLowerCase().includes('codeql') || w.path?.includes('codeql')
  );
  
  return anyCodeQL ? anyCodeQL.id : null;
}
```

### Step 2: Customer Migration Guide

1. **Assessment:**
   - Identify repositories using Default Setup
   - Document current scanning frequency and triggers
   - Plan migration timeline

2. **Migration:**
   - Test Advanced Setup in development repositories
   - Update CI/CD pipelines if needed
   - Migrate production repositories in phases

3. **Validation:**
   - Verify on-demand scanning works
   - Confirm security findings are properly reported
   - Test dashboard integration

## Configuration Options

### Workflow Inputs

The Advanced CodeQL workflow supports these inputs for on-demand scans:

- `languages`: Comma-separated languages to analyze
- `config-file`: Path to custom CodeQL config
- `build-mode`: Build mode for compiled languages

### Example API Call

```bash
# Trigger on-demand scan
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/OWNER/REPO/actions/workflows/codeql-advanced.yml/dispatches \
  -d '{
    "ref": "main",
    "inputs": {
      "languages": "javascript,typescript,python",
      "build-mode": "autobuild"
    }
  }'
```

## Security Considerations

1. **Token Permissions:**
   - Classic PAT: Requires `workflow` scope
   - Fine-grained PAT: Requires "Actions: Read and write"

2. **Repository Settings:**
   - Enable Actions
   - Set appropriate workflow permissions
   - Configure branch protection if needed

3. **Rate Limits:**
   - GitHub Actions has usage limits
   - Monitor consumption for large-scale deployments

## Monitoring and Alerts

1. **Dashboard Integration:**
   - Shows last scan date and status
   - Displays security findings
   - Enables bulk scan dispatch

2. **Webhook Integration:**
   - Configure webhooks for scan completion
   - Integrate with alerting systems
   - Track compliance metrics

## Troubleshooting

### Common Issues

1. **403 Permission Error:**
   - Check token scopes/permissions
   - Verify repository Actions settings
   - Ensure workflow file has correct permissions

2. **Workflow Not Found:**
   - Confirm `.github/workflows/codeql-advanced.yml` exists
   - Check file syntax and structure
   - Verify default branch contains the workflow

3. **Analysis Failures:**
   - Check build requirements for compiled languages
   - Verify language detection is correct
   - Review CodeQL configuration file

### Support Resources

- [GitHub CodeQL Documentation](https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning)
- [CodeQL CLI Reference](https://codeql.github.com/docs/codeql-cli/)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)

## Next Steps

1. **Test the Implementation:**
   - Set up Advanced CodeQL in a test repository
   - Verify on-demand scanning works
   - Test dashboard integration

2. **Plan Rollout:**
   - Create migration timeline
   - Train team on new workflows
   - Update documentation and procedures

3. **Monitor and Optimize:**
   - Track scan success rates
   - Monitor resource usage
   - Gather user feedback and iterate