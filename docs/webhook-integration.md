# Real-time Webhook Integration Documentation

## Overview

This implementation provides real-time GitHub webhook integration for the CodeQL Compliance Dashboard, enabling live status updates without manual refresh requirements.

## Architecture

### Components

1. **Frontend Integration**
   - `RealtimeNotifications` component - Displays live notifications and connection status
   - `useRealTimeUpdates` hook - Manages webhook connections and state synchronization
   - `WebhookService` - Handles EventSource connections and event processing

2. **Backend Endpoints (Azure Functions)**
   - `/api/webhook/github` - Receives GitHub workflow_run webhooks
   - `/api/webhook/events` - Server-Sent Events endpoint for client connections

### Data Flow

1. GitHub workflow completes → sends webhook to `/api/webhook/github`
2. Azure Function validates signature and processes event
3. Function broadcasts update via SSE to connected clients
4. Frontend receives update and updates UI state in real-time
5. Users see live status changes and notifications

## Setup Instructions

### 1. GitHub Webhook Configuration

Configure a GitHub organization webhook with these settings:

- **Payload URL**: `https://your-app.azurestaticapps.net/api/webhook/github`
- **Content Type**: `application/json`
- **Secret**: Generate a secure secret and store in Azure App Settings as `GITHUB_WEBHOOK_SECRET`
- **Events**: Select "Workflow runs" only
- **Active**: ✓ Enabled

### 2. Azure Environment Variables

Set these in your Azure Static Web App configuration:

```bash
GITHUB_WEBHOOK_SECRET=your-secure-webhook-secret-here
```

### 3. Frontend Configuration

The real-time features are automatically enabled when:

1. User is connected to GitHub (has valid token and org)
2. The app detects the webhook endpoints are available

## Features

### Real-time Status Updates

- Repository scan status changes (pending → in_progress → success/failure)
- Automatic removal from "scanning" state when complete
- Live findings count updates
- Scan request status synchronization

### Push Notifications

- Browser notifications for critical security findings (if permission granted)
- Toast notifications for scan completions and failures
- Visual indicators for unread notifications

### Connection Management

- Automatic connection on GitHub auth
- Connection status indicator (Live/Connecting/Offline)
- Automatic reconnection with exponential backoff
- Manual connect/disconnect controls

### Notification System

- Persistent notification history (last 100 items)
- Read/unread status tracking
- Severity-based icons and colors
- Repository context linking
- Bulk mark as read functionality

## Security Features

### Webhook Signature Verification

All webhook requests are verified using HMAC-SHA256 signatures:

```typescript
const isValid = await WebhookService.verifySignature(
  payload, 
  githubSignature, 
  webhookSecret
);
```

### Event Filtering

- Only processes `workflow_run` events
- Filters for CodeQL-related workflows only
- Validates payload structure before processing

### Rate Limiting & Error Handling

- Connection retry logic with exponential backoff
- Maximum reconnection attempts (5)
- Error boundary protection in UI components
- Graceful degradation when webhooks unavailable

## Testing

### Manual Webhook Testing

You can simulate webhook events for testing:

```typescript
const { processWebhookEvent } = useRealTimeUpdates();

const testEvent = {
  action: 'completed',
  workflow_run: {
    id: 123,
    name: 'CodeQL Analysis',
    status: 'completed',
    conclusion: 'success',
    // ... other properties
  },
  repository: {
    id: 1,
    name: 'test-repo',
    full_name: 'org/test-repo',
  }
};

await processWebhookEvent(testEvent, githubToken, orgName);
```

### Development Mode

For local development without webhooks:

```typescript
// Disable auto-connect and use manual triggers
const { connect, disconnect, processWebhookEvent } = useRealTimeUpdates({
  autoConnect: false,
  showToastNotifications: true
});
```

## Production Considerations

### Scaling

- SSE connections are stateless and can scale horizontally
- Consider Azure SignalR Service for high-volume scenarios
- Use Azure Service Bus for reliable event delivery

### Monitoring

Monitor these metrics:

- Webhook delivery success rate
- SSE connection count and duration
- Event processing latency
- Client reconnection frequency

### Performance

- Events are filtered early to reduce processing
- Client-side state updates use React's batching
- Notifications are limited to prevent memory issues
- Connection management prevents resource leaks

## Troubleshooting

### Common Issues

1. **Webhooks not received**
   - Check GitHub webhook configuration
   - Verify Azure Function is deployed and accessible
   - Confirm webhook secret matches environment variable

2. **SSE connection fails**
   - Check CORS configuration
   - Verify Azure Static Web App routing
   - Confirm browser EventSource support

3. **State not updating**
   - Check browser console for errors
   - Verify GitHub token permissions
   - Confirm organization name matches webhook payload

### Debug Mode

Enable debug logging:

```typescript
// Add to browser console
localStorage.setItem('webhook-debug', 'true');
```

This will log detailed webhook events and connection status to the console.

## Future Enhancements

1. **Enhanced Reliability**
   - Event queue with retry logic
   - Webhook delivery confirmations
   - Client-side event persistence

2. **Advanced Features**
   - Real-time collaboration indicators
   - Live scan progress tracking
   - Historical event replay

3. **Scalability**
   - Redis-backed SSE connections
   - WebSocket fallback support
   - Multi-region deployment

## API Reference

### Webhook Event Types

```typescript
interface GitHubWorkflowEvent {
  action: 'completed' | 'requested' | 'in_progress';
  workflow_run: {
    id: number;
    name: string;
    status: 'completed' | 'in_progress' | 'queued';
    conclusion: 'success' | 'failure' | null;
    // ... additional properties
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
  };
}
```

### Real-time Update Types

```typescript
interface RealtimeUpdate {
  type: 'repository_status' | 'scan_completion' | 'notification';
  timestamp: string;
  data: {
    repositoryId?: number;
    status?: 'success' | 'failure' | 'in_progress' | 'pending';
    findings?: SecurityFindings;
    notification?: WebhookNotification;
  };
}
```