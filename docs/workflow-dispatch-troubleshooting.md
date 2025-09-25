# GitHub Workflow Dispatch 403 Error - Troubleshooting Guide

This document provides troubleshooting steps for resolving 403 errors when attempting to dispatch GitHub workflows programmatically.

## Common Error Messages

### 1. "Resource not accessible by personal access token"
```json
{
  "message": "Resource not accessible by personal access token",
  "documentation_url": "https://docs.github.com/rest/actions/workflows#create-a-workflow-dispatch-event",
  "status": "403"
}
```

### 2. "GitHub API error: 403 - Insufficient permissions for workflow dispatch"
This is the enhanced error message from this application that provides specific guidance.

## Root Causes and Solutions

### Token Scope Issues

#### Classic Personal Access Token (PAT)
**Required Scopes:**
- `repo` (Full control of private repositories)
- `workflow` (Update GitHub Action workflows)

**To Fix:**
1. Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. Edit your existing token or create a new one
3. Ensure both `repo` and `workflow` scopes are checked
4. Click "Update token" or "Generate token"

#### Fine-grained Personal Access Token
**Required Permissions:**
- **Repository permissions:**
  - Actions: Read and write
  - Contents: Read
  - Pull requests: Read (if dispatching on PR events)

**To Fix:**
1. Go to GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens
2. Edit your existing token or create a new one
3. Under "Repository permissions", set:
   - Actions → Read and write
   - Contents → Read
4. Click "Update token" or "Generate token"

### Repository Settings

#### Actions Workflow Permissions
Repository must allow workflow modifications.

**To Fix:**
1. Go to your repository Settings
2. Navigate to Actions > General
3. Under "Workflow permissions", select:
   - ✅ **Read and write permissions**
   - ❌ ~~Read repository contents and packages permissions~~
4. Click "Save"

#### Actions Enabled
Ensure GitHub Actions are enabled for the repository.

**To Fix:**
1. Go to repository Settings > Actions > General
2. Under "Actions permissions", select:
   - ✅ **Allow all actions and reusable workflows**
   - Or configure specific allowed actions as needed
3. Click "Save"

### Organization Settings (SSO)

#### Single Sign-On Authorization
If your repository is in an organization with SSO enabled, your token must be authorized.

**To Fix:**
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Find your token and click "Configure SSO"
3. Click "Authorize" next to your organization
4. Complete the SSO flow if prompted

### Workflow Configuration

#### Missing workflow_dispatch Trigger
The target workflow must support manual dispatch.

**Example workflow configuration:**
```yaml
name: "CodeQL Security Analysis"

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]
  workflow_dispatch:  # ← This enables manual dispatch
    inputs:
      reason:
        description: 'Reason for manual scan'
        required: false
        default: 'On-demand compliance scan'

jobs:
  analyze:
    # ... job configuration
```

**To Fix:**
1. Add `workflow_dispatch:` to the `on:` section of your workflow
2. Commit and push the changes to the default branch

## Testing Your Configuration

### Using curl
```bash
# Replace with your values
GITHUB_TOKEN="your_token_here"
REPO_OWNER="your_username_or_org"
REPO_NAME="your_repo_name"
WORKFLOW_ID="your_workflow_file.yml"

curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/workflows/$WORKFLOW_ID/dispatches \
  -d '{"ref":"main","inputs":{}}'
```

**Expected Response:**
- **Success:** HTTP 204 No Content (empty response body)
- **Failure:** HTTP 403 with error details

### Using the Application
The application now provides enhanced error messages with specific suggestions:

1. **Pre-flight Check:** The app validates permissions before attempting dispatch
2. **Enhanced 403 Handling:** Specific error messages guide you to the exact fix needed
3. **Workflow Detection:** Automatic detection of CodeQL workflows with better error messages

## Verification Checklist

Use this checklist to systematically verify your setup:

- [ ] **Token Scopes:**
  - [ ] Classic PAT has `repo` and `workflow` scopes
  - [ ] Fine-grained PAT has Actions: Read & write permission
- [ ] **Repository Settings:**
  - [ ] Actions are enabled
  - [ ] Workflow permissions set to "Read and write"
- [ ] **Organization (if applicable):**
  - [ ] Token is authorized for SSO
- [ ] **Workflow File:**
  - [ ] Contains `workflow_dispatch:` trigger
  - [ ] File is committed to default branch
  - [ ] YAML syntax is valid
- [ ] **Test:** curl command returns 204 (success)

## Advanced Troubleshooting

### Check Workflow ID
List workflows to find the correct ID:
```bash
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/workflows
```

### Check Repository Permissions
Verify your token can access the repository:
```bash
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/$REPO_OWNER/$REPO_NAME
```

### GitHub App vs Personal Access Token
This guide covers Personal Access Tokens. GitHub Apps have different permission models and may require additional setup.

## Documentation References

- [GitHub REST API - Workflow Dispatches](https://docs.github.com/rest/actions/workflows#create-a-workflow-dispatch-event)
- [GitHub Personal Access Tokens](https://docs.github.com/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [GitHub Actions Permissions](https://docs.github.com/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)
- [Fine-grained Personal Access Tokens](https://docs.github.com/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-fine-grained-personal-access-token)