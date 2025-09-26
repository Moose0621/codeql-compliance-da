import { createHmac, timingSafeEqual } from 'crypto';
import type { 
  WebhookSignature, 
  WebhookValidationResult, 
  WebhookEventType,
  GitHubWebhookEvent 
} from '@/types/dashboard';

/**
 * Webhook signature verification and payload validation utilities
 * Implements GitHub's webhook security best practices
 */

/**
 * Verifies GitHub webhook signature using HMAC-SHA256
 * @param payload - Raw webhook payload as string
 * @param signature - GitHub signature from X-Hub-Signature-256 header
 * @param secret - Webhook secret
 * @returns boolean indicating if signature is valid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!payload || !signature || !secret) {
    return false;
  }

  // Remove 'sha256=' prefix if present
  const cleanSignature = signature.startsWith('sha256=') 
    ? signature.slice(7) 
    : signature;

  // Create HMAC hash
  const hmac = createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const expectedSignature = hmac.digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const actualBuffer = Buffer.from(cleanSignature, 'hex');
    
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(expectedBuffer, actualBuffer);
  } catch (error) {
    return false;
  }
}

/**
 * Validates webhook payload structure and headers
 * @param headers - Request headers
 * @param payload - Parsed webhook payload
 * @param secret - Webhook secret for signature verification
 * @returns Validation result with error details if invalid
 */
export function validateWebhookPayload(
  headers: Partial<WebhookSignature> & Record<string, string>,
  payload: any,
  secret: string,
  rawPayload?: string
): WebhookValidationResult {
  // Check required headers
  const eventType = headers['x-github-event'] as WebhookEventType;
  const signature = headers['x-hub-signature-256'];
  const deliveryId = headers['x-github-delivery'];

  if (!eventType) {
    return { isValid: false, error: 'Missing X-GitHub-Event header' };
  }

  if (!signature) {
    return { isValid: false, error: 'Missing X-Hub-Signature-256 header' };
  }

  if (!deliveryId) {
    return { isValid: false, error: 'Missing X-GitHub-Delivery header' };
  }

  // Verify signature if raw payload provided
  if (rawPayload && !verifyWebhookSignature(rawPayload, signature, secret)) {
    return { isValid: false, error: 'Invalid webhook signature' };
  }

  // Validate payload structure
  if (!payload || typeof payload !== 'object') {
    return { isValid: false, error: 'Invalid payload format' };
  }

  // Check for required common fields
  if (!payload.repository || !payload.sender) {
    return { isValid: false, error: 'Missing required payload fields' };
  }

  return {
    isValid: true,
    eventType,
    deliveryId
  };
}

/**
 * Validates payload size against GitHub limits
 * @param payload - Raw payload string
 * @returns boolean indicating if size is within limits
 */
export function validatePayloadSize(payload: string): boolean {
  const maxSize = 25 * 1024 * 1024; // 25MB GitHub limit
  return Buffer.byteLength(payload, 'utf8') <= maxSize;
}

/**
 * Parses webhook event type and validates event-specific structure
 * @param eventType - GitHub event type
 * @param payload - Webhook payload
 * @returns boolean indicating if payload matches expected structure for event type
 */
export function validateEventTypeStructure(
  eventType: WebhookEventType,
  payload: GitHubWebhookEvent
): boolean {
  switch (eventType) {
    case 'workflow_run':
      return !!(payload as any).workflow_run && 
             typeof (payload as any).workflow_run.id === 'number';
    
    case 'code_scanning_alert':
      return !!(payload as any).alert && 
             typeof (payload as any).alert.number === 'number';
    
    case 'push':
      return !!(payload as any).commits && 
             Array.isArray((payload as any).commits) &&
             typeof (payload as any).ref === 'string';
    
    case 'security_advisory':
      return !!(payload as any).security_advisory && 
             typeof (payload as any).security_advisory.ghsa_id === 'string';
    
    case 'pull_request':
      return !!(payload as any).pull_request && 
             typeof (payload as any).pull_request.number === 'number';
    
    case 'repository':
      return !!payload.repository && 
             typeof payload.repository.id === 'number';
    
    default:
      return false;
  }
}

/**
 * Rate limiting for webhook processing
 */
export class WebhookRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly timeWindow: number; // in milliseconds

  constructor(maxRequests = 100, timeWindowMinutes = 1) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindowMinutes * 60 * 1000;
  }

  /**
   * Checks if request should be rate limited
   * @param identifier - Unique identifier (IP, installation ID, etc.)
   * @returns boolean indicating if request is allowed
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Remove expired requests
    const validRequests = requests.filter(
      timestamp => now - timestamp < this.timeWindow
    );
    
    // Check if under limit
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return true;
  }

  /**
   * Clears rate limit data (for testing)
   */
  clear(): void {
    this.requests.clear();
  }
}

/**
 * CORS validation for webhook endpoints
 */
export function validateCorsOrigin(origin: string, allowedOrigins: string[]): boolean {
  if (!origin || !allowedOrigins.length) {
    return false;
  }
  
  return allowedOrigins.includes(origin) || 
         allowedOrigins.some(allowed => {
           if (allowed.includes('*')) {
             const pattern = allowed.replace(/\*/g, '.*');
             const regex = new RegExp(`^${pattern}$`);
             return regex.test(origin);
           }
           return false;
         });
}

/**
 * Creates a mock webhook signature for testing
 * @param payload - Payload to sign
 * @param secret - Secret to use for signing
 * @returns SHA256 signature
 */
export function createMockWebhookSignature(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}