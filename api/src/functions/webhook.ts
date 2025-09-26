import { app } from "@azure/functions";
import { WebhookService } from "../../../src/lib/webhook-service";
import type { GitHubWorkflowEvent } from "../../../src/types/dashboard";

interface RequestBody {
  action?: string;
  workflow_run?: any;
  repository?: any;
  organization?: any;
}

/**
 * Azure Function for handling GitHub webhook events
 * This endpoint would be configured as a GitHub webhook for workflow_run events
 */
app.http("webhook-github", {
  methods: ["POST"],
  authLevel: "anonymous", // In production, use function-level auth
  route: "webhook/github",
  handler: async (request, context) => {
    try {
      // Verify this is a workflow_run event
      const eventType = request.headers.get("x-github-event");
      if (eventType !== "workflow_run") {
        return {
          status: 200,
          body: JSON.stringify({ message: "Event type not handled" })
        };
      }

      // Get the webhook signature for verification
      const signature = request.headers.get("x-hub-signature-256");
      if (!signature) {
        return {
          status: 401,
          body: JSON.stringify({ error: "Missing signature" })
        };
      }

      // Get the raw body for signature verification
      const rawBody = await request.text();
      
      // Get webhook secret from environment
      const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
      if (!webhookSecret) {
        context.error("GitHub webhook secret not configured");
        return {
          status: 500,
          body: JSON.stringify({ error: "Webhook not properly configured" })
        };
      }

      // Verify GitHub webhook signature
      const isValidSignature = await WebhookService.verifySignature(
        rawBody, 
        signature, 
        webhookSecret
      );

      if (!isValidSignature) {
        context.warn("Invalid webhook signature received");
        return {
          status: 401,
          body: JSON.stringify({ error: "Invalid signature" })
        };
      }

      // Parse the webhook payload
      const payload: RequestBody = JSON.parse(rawBody);
      
      // Only process CodeQL workflow events
      if (!payload.workflow_run?.name?.toLowerCase().includes('codeql') && 
          !payload.workflow_run?.path?.includes('codeql')) {
        return {
          status: 200,
          body: JSON.stringify({ message: "Non-CodeQL workflow ignored" })
        };
      }

      // Transform to our expected format
      const workflowEvent: GitHubWorkflowEvent = {
        action: payload.action as any,
        workflow_run: {
          id: payload.workflow_run.id,
          name: payload.workflow_run.name,
          html_url: payload.workflow_run.html_url,
          status: payload.workflow_run.status,
          conclusion: payload.workflow_run.conclusion,
          created_at: payload.workflow_run.created_at,
          updated_at: payload.workflow_run.updated_at,
          repository: {
            id: payload.repository.id,
            name: payload.repository.name,
            full_name: payload.repository.full_name,
          },
          head_branch: payload.workflow_run.head_branch,
          head_sha: payload.workflow_run.head_sha,
          path: payload.workflow_run.path,
          run_number: payload.workflow_run.run_number,
          event: payload.workflow_run.event,
        },
        repository: {
          id: payload.repository.id,
          name: payload.repository.name,
          full_name: payload.repository.full_name,
          owner: {
            login: payload.repository.owner.login,
            avatar_url: payload.repository.owner.avatar_url,
          },
          default_branch: payload.repository.default_branch,
        },
        organization: payload.organization ? {
          login: payload.organization.login,
        } : undefined,
      };

      // Process the webhook event
      const webhookService = new WebhookService();
      await webhookService.handleWorkflowEvent(workflowEvent);

      context.log(`Processed webhook for workflow: ${workflowEvent.workflow_run.name} (${workflowEvent.workflow_run.status})`);

      // For production, you would broadcast this to connected clients
      // This could be done via SignalR, Service Bus, or another Azure service
      
      return {
        status: 200,
        body: JSON.stringify({ 
          message: "Webhook processed successfully",
          workflow: workflowEvent.workflow_run.name,
          status: workflowEvent.workflow_run.status
        })
      };

    } catch (error) {
      context.error("Error processing webhook:", error);
      return {
        status: 500,
        body: JSON.stringify({ 
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error"
        })
      };
    }
  }
});

/**
 * Azure Function for Server-Sent Events endpoint
 * Clients connect to this endpoint to receive real-time updates
 */
app.http("webhook-events", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "webhook/events",
  handler: async (request, context) => {
    try {
      // Set SSE headers
      const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      };

      // In a real implementation, this would:
      // 1. Authenticate the user
      // 2. Subscribe to relevant events (e.g., from Service Bus)
      // 3. Stream events to the client
      // 4. Handle client disconnection

      // For now, return a placeholder response
      const sseData = `data: ${JSON.stringify({
        type: 'connection_status',
        timestamp: new Date().toISOString(),
        data: { status: 'connected', message: 'SSE endpoint ready' }
      })}\n\n`;

      return {
        status: 200,
        headers,
        body: sseData
      };

    } catch (error) {
      context.error("Error in SSE endpoint:", error);
      return {
        status: 500,
        body: JSON.stringify({ error: "SSE endpoint error" })
      };
    }
  }
});