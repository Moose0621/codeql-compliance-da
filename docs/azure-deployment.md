# Azure Deployment Guide

## Prerequisites

Before deploying the CodeQL Compliance Dashboard to Azure, ensure you have:

1. **Azure Subscription** with appropriate permissions
2. **GitHub Repository** with the application code
3. **GitHub App** configured for API access
4. **Azure CLI** installed and authenticated
5. **Node.js 20+** for local development and testing

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/Moose0621/codeql-compliance-da.git
cd codeql-compliance-da
npm install
```

### 2. Create GitHub App

1. Navigate to your GitHub organization settings
2. Go to "Developer settings" > "GitHub Apps"
3. Click "New GitHub App"
4. Configure the app with these settings:

**Basic Information:**
- App name: `CodeQL Compliance Dashboard`
- Homepage URL: `https://your-domain.com` (will update after deployment)
- Webhook URL: `https://your-functions-app.azurewebsites.net/api/webhooks/github` (optional for now)

**Permissions:**
- Repository permissions:
  - Actions: Read & Write (for workflow dispatch)
  - Contents: Read
  - Metadata: Read
  - Security events: Read
- Organization permissions:
  - Actions: Read
  - Security events: Read

**Events (for future webhook support):**
- Workflow run
- Code scanning alert

4. Generate and download the private key
5. Note the App ID and Installation ID

### 3. Deploy Infrastructure

```bash
# Create resource group
az group create --name rg-codeql-compliance-dev --location "East US 2"

# Deploy infrastructure
az deployment group create \
  --resource-group rg-codeql-compliance-dev \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.parameters.json
```

### 4. Configure Secrets

After deployment, configure the Key Vault secrets:

```bash
# Get Key Vault name from deployment output
KEYVAULT_NAME=$(az deployment group show --resource-group rg-codeql-compliance-dev --name main --query properties.outputs.keyVaultName.value -o tsv)

# Store GitHub App secrets
az keyvault secret set --vault-name $KEYVAULT_NAME --name "github-app-id" --value "YOUR_GITHUB_APP_ID"
az keyvault secret set --vault-name $KEYVAULT_NAME --name "github-installation-id" --value "YOUR_INSTALLATION_ID"
az keyvault secret set --vault-name $KEYVAULT_NAME --name "github-app-private-key" --file path/to/private-key.pem
```

### 5. Configure GitHub Actions

Set up the following repository secrets for CI/CD:

```bash
# Azure authentication (using OIDC - recommended)
AZURE_CLIENT_ID=<service-principal-client-id>
AZURE_TENANT_ID=<tenant-id>
AZURE_SUBSCRIPTION_ID=<subscription-id>

# Static Web Apps deployment token
AZURE_STATIC_WEB_APPS_API_TOKEN=<swa-deployment-token>

# Preview environment tokens (optional)
PREVIEW_GITHUB_TOKEN=<personal-access-token-for-testing>
PREVIEW_GITHUB_ORG=<test-organization>
```

### 6. Deploy Application

The application will be automatically deployed via GitHub Actions when you push to main or create a release tag.

Manual deployment:

```bash
# Build the application
npm run build

# Deploy via Azure CLI (if not using GitHub Actions)
az staticwebapp deploy \
  --name <static-web-app-name> \
  --source-path ./dist \
  --resource-group rg-codeql-compliance-dev
```

## Environment Configuration

### Development Environment

The development environment uses:
- **Resource Group**: `rg-codeql-compliance-dev`
- **App Service Plan**: B1 (Basic)
- **Key Vault**: Soft delete enabled, 7-day retention
- **Storage**: LRS replication
- **Application Insights**: 30-day retention

### Production Environment

For production deployment:

```bash
# Create production resource group
az group create --name rg-codeql-compliance-prod --location "East US 2"

# Deploy with production parameters
az deployment group create \
  --resource-group rg-codeql-compliance-prod \
  --template-file infra/main.bicep \
  --parameters infra/parameters/prod.parameters.json
```

Production configuration includes:
- **App Service Plan**: S1 (Standard) for better performance
- **Key Vault**: Purge protection enabled
- **Storage**: GRS replication for disaster recovery
- **Application Insights**: 90-day retention

## GitHub Actions Setup

### Azure OIDC Configuration

Set up federated credentials for secure authentication:

1. Create an App Registration in Azure AD
2. Configure federated credentials for GitHub Actions
3. Assign appropriate RBAC roles to the service principal

```bash
# Create service principal
az ad sp create-for-rbac \
  --name "sp-codeql-compliance-github" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/rg-codeql-compliance-prod

# Configure federated credentials
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "codeql-compliance-github",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:Moose0621/codeql-compliance-da:environment:production",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

### Workflow Configuration

The following workflows are automatically configured:

- **ci.yml**: Runs on every PR and push to main
- **codeql.yml**: Security analysis on push and PR
- **dependency-review.yml**: Dependency vulnerability scanning on PR
- **release.yml**: Production deployment on tagged releases
- **preview-deploy.yml**: Preview deployments for PRs

## Application Configuration

### Environment Variables

The application uses the following environment variables:

**Build-time (Vite):**
- `VITE_API_BASE_URL`: Base URL for backend API
- `VITE_GITHUB_TOKEN`: GitHub token (development only)
- `VITE_GITHUB_ORG`: GitHub organization (development only)

**Runtime (Azure Functions):**
- `KEY_VAULT_NAME`: Name of the Key Vault
- `STORAGE_ACCOUNT_NAME`: Name of the Storage Account
- `APPINSIGHTS_INSTRUMENTATIONKEY`: Application Insights key
- `ENVIRONMENT`: Current environment (dev, staging, prod)

### Custom Domains (Optional)

To configure custom domains:

1. Add domain to Static Web Apps
2. Configure DNS records
3. Update CORS settings in Functions app

```bash
# Add custom domain
az staticwebapp hostname set \
  --name <static-web-app-name> \
  --hostname your-domain.com \
  --resource-group rg-codeql-compliance-prod
```

## Monitoring and Logging

### Application Insights Queries

Key queries for monitoring:

```kql
// API Performance
requests
| where timestamp > ago(1h)
| where url contains "/api/"
| summarize avg(duration), percentile(duration, 95) by operation_Name

// Error Rate
requests
| where timestamp > ago(24h)
| summarize total_requests = count(), failed_requests = countif(success == false)
| extend error_rate = (failed_requests * 100.0) / total_requests

// GitHub API Rate Limits
customEvents
| where timestamp > ago(1h)
| where name == "GitHubRateLimit"
| project timestamp, remaining = tolong(customDimensions.remaining), limit = tolong(customDimensions.limit)
```

### Alerts Configuration

Recommended alerts:

```bash
# High error rate alert
az monitor metrics alert create \
  --name "High Error Rate" \
  --resource-group rg-codeql-compliance-prod \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/rg-codeql-compliance-prod/providers/Microsoft.Web/sites/$FUNCTIONS_APP_NAME \
  --condition "count 'requests/failed' > 10" \
  --window-size 5m
```

## Troubleshooting

### Common Issues

**1. Deployment Failures**

```bash
# Check deployment status
az deployment group show \
  --resource-group rg-codeql-compliance-dev \
  --name main \
  --query properties.provisioningState

# View error details
az deployment group show \
  --resource-group rg-codeql-compliance-dev \
  --name main \
  --query properties.error
```

**2. GitHub App Authentication Issues**

- Verify App ID and Installation ID in Key Vault
- Check private key format (PEM)
- Ensure app has correct permissions
- Verify installation is active

**3. Static Web Apps Issues**

```bash
# Check Static Web Apps status
az staticwebapp show \
  --name <static-web-app-name> \
  --resource-group rg-codeql-compliance-dev

# View deployment logs
az staticwebapp logs show \
  --name <static-web-app-name> \
  --resource-group rg-codeql-compliance-dev
```

### Support Resources

- [Azure Static Web Apps Documentation](https://docs.microsoft.com/azure/static-web-apps/)
- [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
- [GitHub Apps Documentation](https://docs.github.com/developers/apps)
- [Application Insights Documentation](https://docs.microsoft.com/azure/azure-monitor/app/app-insights-overview)

## Security Considerations

### Production Checklist

- [ ] Key Vault purge protection enabled
- [ ] Storage account public access disabled
- [ ] Functions app HTTPS only
- [ ] CORS configured for specific domains
- [ ] Network access restrictions configured
- [ ] Diagnostic settings enabled
- [ ] Backup and retention policies configured
- [ ] Security alerts configured

### Compliance Requirements

For FedRAMP compliance:
- Enable audit logging for all resources
- Configure data retention policies
- Implement backup and disaster recovery
- Document security controls
- Regular security assessments

## Cost Optimization

### Resource Sizing

**Development:**
- Static Web Apps: Free tier
- Functions: Consumption plan
- Storage: Standard LRS
- Key Vault: Standard tier

**Production:**
- Static Web Apps: Standard tier
- Functions: Premium plan (for better cold start performance)
- Storage: Standard GRS
- Key Vault: Standard tier with HSM for sensitive secrets

### Monitoring Costs

```bash
# View cost analysis
az consumption usage list \
  --start-date 2024-01-01 \
  --end-date 2024-01-31 \
  --query '[?contains(instanceName, "codeql-compliance")]'
```