# CodeQL On-Demand Scanning Solution

## Problem Summary

Your customer needs on-demand CodeQL scanning capabilities, but GitHub's **Default Setup** doesn't support `workflow_dispatch` triggers. This is a fundamental limitation where customers must choose between:

- **Default Setup**: Automatic, zero-config, but no on-demand capability
- **Advanced Setup**: Full control including on-demand, but requires manual configuration

## Recommended Solutions

### 1. Switch to Advanced Setup (Primary Recommendation)

**Best for:** Customers who need on-demand scanning and don't mind managing workflows

```yaml
# .github/workflows/codeql-advanced.yml
name: "CodeQL Advanced Analysis"
on:
  push:
    branches: [ "main", "master" ]
  pull_request:
    branches: [ "main", "master" ]
  schedule:
    - cron: '30 2 * * *'  # Daily at 2:30 AM UTC
  workflow_dispatch:      # Enables on-demand scanning
    inputs:
      languages:
        description: 'Languages to analyze'
        required: false
        default: 'javascript,typescript'
```

**Migration Steps:**
1. Disable Default Setup in repository settings
2. Add the Advanced workflow file
3. Configure repository permissions
4. Test on-demand functionality

### 2. Hybrid API Approach (Alternative)

**Best for:** Customers wanting to keep Default Setup but occasionally need on-demand scans

Create temporary workflows programmatically:
```javascript
async function triggerOnDemandScan(repo) {
  // 1. Create temporary branch
  const scanBranch = `codeql-scan-${Date.now()}`;
  
  // 2. Add workflow to branch
  await addWorkflowFile(repo, scanBranch, codeqlWorkflow);
  
  // 3. Trigger workflow
  await dispatchWorkflow(repo, 'codeql.yml', scanBranch);
  
  // 4. Clean up after completion
}
```

### 3. Dashboard Integration Enhancement

The dashboard now includes:

#### Repository Analysis Tool
- **`CodeQLSetupAnalyzer` Component**: Analyzes current setup and provides migration guidance
- **`analyzeCodeQLCapabilities()` Function**: Determines what type of setup exists
- **`generateMigrationPlan()` Function**: Provides step-by-step migration instructions

#### Enhanced GitHub Service
- **Improved workflow detection**: Prioritizes Advanced Setup workflows
- **Better error handling**: Provides clear guidance on permission issues
- **Validation tools**: Checks if on-demand scanning will work

## Implementation Files Created

1. **`.github/workflows/codeql-advanced.yml`** - Advanced CodeQL workflow template
2. **`docs/codeql-ondemand-setup.md`** - Comprehensive setup guide  
3. **`src/lib/codeql-analysis.ts`** - Analysis and validation utilities
4. **`src/components/CodeQLSetupAnalyzer.tsx`** - UI component for setup analysis

## Customer Decision Matrix

| Need | Recommendation | Setup Time | Maintenance |
|------|----------------|------------|-------------|
| Basic security scanning | Default Setup | 5 minutes | Zero |
| On-demand + automation | Advanced Setup | 1-2 hours | Low |
| Mixed requirements | Hybrid approach | 2-4 hours | Medium |

## Key Benefits

### For Advanced Setup:
- ✅ Full on-demand scanning capability
- ✅ Custom queries and configurations  
- ✅ Flexible scheduling options
- ✅ Dashboard integration works seamlessly
- ❌ Requires workflow maintenance

### For Hybrid Approach:
- ✅ Keeps existing Default Setup
- ✅ On-demand when needed
- ✅ Minimal workflow maintenance
- ❌ More complex implementation
- ❌ Temporary branches create noise

## Next Steps for Customer

1. **Assessment Phase:**
   - Use `CodeQLSetupAnalyzer` component to analyze current repositories
   - Identify which repositories need on-demand scanning
   - Review migration timeline and resource requirements

2. **Pilot Implementation:**
   - Start with 2-3 non-critical repositories
   - Test Advanced Setup workflow
   - Validate dashboard integration
   - Train team on new processes

3. **Full Deployment:**
   - Create rollout plan based on pilot results
   - Migrate repositories in phases
   - Monitor and optimize performance
   - Document final procedures

## Support and Troubleshooting

The solution includes comprehensive validation tools:

- **Permission checking**: Identifies token scope issues
- **Workflow validation**: Ensures proper configuration
- **Migration guidance**: Step-by-step instructions based on current setup
- **Error diagnostics**: Clear error messages with actionable solutions

## Risk Mitigation

- **Test thoroughly**: Pilot in dev/staging repositories first
- **Backup configurations**: Document current Default Setup settings
- **Gradual migration**: Don't migrate all repositories at once
- **Monitor results**: Compare scan results between old and new setups
- **Rollback plan**: Keep Default Setup disabled (not deleted) during testing

This solution provides your customer with multiple paths forward, comprehensive tooling for analysis and migration, and ongoing support through the enhanced dashboard capabilities.