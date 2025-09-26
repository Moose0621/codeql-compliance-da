import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  verifyWebhookSignature,
  validateWebhookPayload,
  validatePayloadSize,
  validateEventTypeStructure,
  WebhookRateLimiter,
  validateCorsOrigin,
  createMockWebhookSignature
} from '@/lib/webhook-utils';
import type {
  WebhookSignature,
  WorkflowRunWebhookEvent,
  CodeScanningAlertWebhookEvent,
  PushWebhookEvent,
  SecurityAdvisoryWebhookEvent
} from '@/types/dashboard';

describe('webhook-utils', () => {
  const mockSecret = 'test-secret-key-123';
  const mockPayload = JSON.stringify({
    action: 'completed',
    repository: { id: 123, name: 'test-repo', full_name: 'org/test-repo' },
    sender: { login: 'test-user', avatar_url: 'https://avatars.example.com/u/1' }
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid signature', () => {
      const signature = createMockWebhookSignature(mockPayload, mockSecret);
      const result = verifyWebhookSignature(mockPayload, signature, mockSecret);
      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const signature = 'sha256=invalid_signature_hash';
      const result = verifyWebhookSignature(mockPayload, signature, mockSecret);
      expect(result).toBe(false);
    });

    it('should reject signature with wrong secret', () => {
      const signature = createMockWebhookSignature(mockPayload, 'wrong-secret');
      const result = verifyWebhookSignature(mockPayload, signature, mockSecret);
      expect(result).toBe(false);
    });

    it('should handle signature without sha256 prefix', () => {
      const fullSignature = createMockWebhookSignature(mockPayload, mockSecret);
      const hashOnly = fullSignature.replace('sha256=', '');
      const result = verifyWebhookSignature(mockPayload, hashOnly, mockSecret);
      expect(result).toBe(true);
    });

    it('should reject malformed signatures', () => {
      expect(verifyWebhookSignature(mockPayload, '', mockSecret)).toBe(false);
      expect(verifyWebhookSignature(mockPayload, 'not-hex', mockSecret)).toBe(false);
      expect(verifyWebhookSignature('', 'sha256=hash', mockSecret)).toBe(false);
      expect(verifyWebhookSignature(mockPayload, 'sha256=hash', '')).toBe(false);
    });

    it('should prevent timing attacks with different length signatures', () => {
      const shortSignature = 'sha256=abc123';
      const result = verifyWebhookSignature(mockPayload, shortSignature, mockSecret);
      expect(result).toBe(false);
    });
  });

  describe('validateWebhookPayload', () => {
    const validHeaders: WebhookSignature = {
      'x-github-event': 'workflow_run',
      'x-github-delivery': 'test-delivery-id-123',
      'x-hub-signature-256': createMockWebhookSignature(mockPayload, mockSecret),
      'x-github-hook-id': '123',
      'x-github-hook-installation-target-id': '456',
      'x-github-hook-installation-target-type': 'organization'
    };

    const validPayload = JSON.parse(mockPayload);

    it('should validate complete valid payload', () => {
      const result = validateWebhookPayload(
        validHeaders,
        validPayload,
        mockSecret,
        mockPayload
      );
      
      expect(result.isValid).toBe(true);
      expect(result.eventType).toBe('workflow_run');
      expect(result.deliveryId).toBe('test-delivery-id-123');
    });

    it('should reject missing event type header', () => {
      const invalidHeaders = { ...validHeaders };
      delete invalidHeaders['x-github-event'];
      
      const result = validateWebhookPayload(invalidHeaders, validPayload, mockSecret);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing X-GitHub-Event header');
    });

    it('should reject missing signature header', () => {
      const invalidHeaders = { ...validHeaders };
      delete invalidHeaders['x-hub-signature-256'];
      
      const result = validateWebhookPayload(invalidHeaders, validPayload, mockSecret);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing X-Hub-Signature-256 header');
    });

    it('should reject missing delivery ID header', () => {
      const invalidHeaders = { ...validHeaders };
      delete invalidHeaders['x-github-delivery'];
      
      const result = validateWebhookPayload(invalidHeaders, validPayload, mockSecret);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing X-GitHub-Delivery header');
    });

    it('should reject invalid signature', () => {
      const invalidHeaders = {
        ...validHeaders,
        'x-hub-signature-256': 'sha256=invalid_signature'
      };
      
      const result = validateWebhookPayload(
        invalidHeaders,
        validPayload,
        mockSecret,
        mockPayload
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid webhook signature');
    });

    it('should reject invalid payload format', () => {
      const result = validateWebhookPayload(validHeaders, null, mockSecret);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid payload format');
    });

    it('should reject payload missing required fields', () => {
      const invalidPayload = { action: 'completed' }; // missing repository and sender
      
      const result = validateWebhookPayload(validHeaders, invalidPayload, mockSecret);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required payload fields');
    });

    it('should validate without signature check when no raw payload provided', () => {
      const result = validateWebhookPayload(validHeaders, validPayload, mockSecret);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validatePayloadSize', () => {
    it('should accept small payloads', () => {
      const smallPayload = JSON.stringify({ test: 'data' });
      expect(validatePayloadSize(smallPayload)).toBe(true);
    });

    it('should reject oversized payloads', () => {
      // Create a payload larger than 25MB
      const largeData = 'x'.repeat(26 * 1024 * 1024);
      expect(validatePayloadSize(largeData)).toBe(false);
    });

    it('should handle edge case at size limit', () => {
      // Create a payload exactly at 25MB limit
      const limitData = 'x'.repeat(25 * 1024 * 1024 - 10); // Leave some buffer for JSON
      expect(validatePayloadSize(limitData)).toBe(true);
    });

    it('should handle unicode characters correctly', () => {
      const unicodePayload = JSON.stringify({ message: '🎉'.repeat(1000) });
      expect(validatePayloadSize(unicodePayload)).toBe(true);
    });
  });

  describe('validateEventTypeStructure', () => {
    it('should validate workflow_run event structure', () => {
      const workflowEvent: WorkflowRunWebhookEvent = {
        action: 'completed',
        repository: { id: 123, name: 'test', full_name: 'org/test', owner: { login: 'org', avatar_url: '' } },
        sender: { login: 'user', avatar_url: '' },
        workflow_run: {
          id: 456,
          name: 'CodeQL',
          status: 'completed',
          conclusion: 'success',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:05:00Z',
          html_url: 'https://github.com/org/test/actions/runs/456',
          run_number: 1,
          workflow_id: 789,
          head_commit: { id: 'abc123', message: 'test', author: { name: 'user', email: 'user@example.com' } }
        }
      };

      expect(validateEventTypeStructure('workflow_run', workflowEvent)).toBe(true);
    });

    it('should validate code_scanning_alert event structure', () => {
      const alertEvent: CodeScanningAlertWebhookEvent = {
        action: 'created',
        repository: { id: 123, name: 'test', full_name: 'org/test', owner: { login: 'org', avatar_url: '' } },
        sender: { login: 'user', avatar_url: '' },
        alert: {
          number: 1,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          dismissed_at: null,
          dismissed_by: null,
          dismissed_reason: null,
          rule: { id: 'rule-1', severity: 'error', security_severity_level: 'high', description: 'Test rule' },
          state: 'open'
        }
      };

      expect(validateEventTypeStructure('code_scanning_alert', alertEvent)).toBe(true);
    });

    it('should validate push event structure', () => {
      const pushEvent: PushWebhookEvent = {
        action: 'pushed',
        repository: { id: 123, name: 'test', full_name: 'org/test', owner: { login: 'org', avatar_url: '' } },
        sender: { login: 'user', avatar_url: '' },
        ref: 'refs/heads/main',
        before: 'abc123',
        after: 'def456',
        commits: [{
          id: 'def456',
          message: 'Test commit',
          author: { name: 'user', email: 'user@example.com' },
          added: ['file.js'],
          removed: [],
          modified: []
        }],
        head_commit: {
          id: 'def456',
          message: 'Test commit',
          author: { name: 'user', email: 'user@example.com' }
        }
      };

      expect(validateEventTypeStructure('push', pushEvent)).toBe(true);
    });

    it('should validate security_advisory event structure', () => {
      const advisoryEvent: SecurityAdvisoryWebhookEvent = {
        action: 'published',
        repository: { id: 123, name: 'test', full_name: 'org/test', owner: { login: 'org', avatar_url: '' } },
        sender: { login: 'user', avatar_url: '' },
        security_advisory: {
          ghsa_id: 'GHSA-xxxx-xxxx-xxxx',
          cve_id: 'CVE-2023-1234',
          summary: 'Test advisory',
          description: 'Test description',
          severity: 'high',
          published_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          withdrawn_at: null,
          vulnerabilities: [{
            package: { ecosystem: 'npm', name: 'test-package' },
            severity: 'high',
            vulnerable_version_range: '< 1.0.0',
            first_patched_version: { identifier: '1.0.0' }
          }]
        }
      };

      expect(validateEventTypeStructure('security_advisory', advisoryEvent)).toBe(true);
    });

    it('should reject invalid event structures', () => {
      const invalidEvent = {
        action: 'test',
        repository: { id: 123, name: 'test', full_name: 'org/test', owner: { login: 'org', avatar_url: '' } },
        sender: { login: 'user', avatar_url: '' }
      };

      expect(validateEventTypeStructure('workflow_run', invalidEvent as any)).toBe(false);
      expect(validateEventTypeStructure('code_scanning_alert', invalidEvent as any)).toBe(false);
      expect(validateEventTypeStructure('push', invalidEvent as any)).toBe(false);
    });

    it('should reject unknown event types', () => {
      const event = {
        action: 'test',
        repository: { id: 123, name: 'test', full_name: 'org/test', owner: { login: 'org', avatar_url: '' } },
        sender: { login: 'user', avatar_url: '' }
      };

      expect(validateEventTypeStructure('unknown_event' as any, event)).toBe(false);
    });
  });

  describe('WebhookRateLimiter', () => {
    let rateLimiter: WebhookRateLimiter;

    beforeEach(() => {
      rateLimiter = new WebhookRateLimiter(2, 0.01); // 2 requests per 0.01 minutes (600ms)
    });

    it('should allow requests under limit', () => {
      expect(rateLimiter.isAllowed('client-1')).toBe(true);
      expect(rateLimiter.isAllowed('client-1')).toBe(true);
    });

    it('should reject requests over limit', () => {
      rateLimiter.isAllowed('client-1');
      rateLimiter.isAllowed('client-1');
      expect(rateLimiter.isAllowed('client-1')).toBe(false);
    });

    it('should handle multiple clients separately', () => {
      rateLimiter.isAllowed('client-1');
      rateLimiter.isAllowed('client-1');
      
      // Different client should still be allowed
      expect(rateLimiter.isAllowed('client-2')).toBe(true);
    });

    it('should reset after time window expires', async () => {
      rateLimiter.isAllowed('client-1');
      rateLimiter.isAllowed('client-1');
      expect(rateLimiter.isAllowed('client-1')).toBe(false);

      // Wait for time window to pass
      await new Promise(resolve => setTimeout(resolve, 700));
      
      expect(rateLimiter.isAllowed('client-1')).toBe(true);
    });

    it('should clear all rate limit data', () => {
      rateLimiter.isAllowed('client-1');
      rateLimiter.isAllowed('client-1');
      
      rateLimiter.clear();
      
      expect(rateLimiter.isAllowed('client-1')).toBe(true);
    });
  });

  describe('validateCorsOrigin', () => {
    const allowedOrigins = [
      'https://example.com',
      'https://*.example.com',
      'http://localhost:*'
    ];

    it('should allow exact origin matches', () => {
      expect(validateCorsOrigin('https://example.com', allowedOrigins)).toBe(true);
    });

    it('should allow wildcard subdomain matches', () => {
      expect(validateCorsOrigin('https://api.example.com', allowedOrigins)).toBe(true);
      expect(validateCorsOrigin('https://cdn.example.com', allowedOrigins)).toBe(true);
    });

    it('should allow wildcard port matches', () => {
      expect(validateCorsOrigin('http://localhost:3000', allowedOrigins)).toBe(true);
      expect(validateCorsOrigin('http://localhost:8080', allowedOrigins)).toBe(true);
    });

    it('should reject non-matching origins', () => {
      expect(validateCorsOrigin('https://malicious.com', allowedOrigins)).toBe(false);
      expect(validateCorsOrigin('https://example.org', allowedOrigins)).toBe(false);
      expect(validateCorsOrigin('http://example.com', allowedOrigins)).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(validateCorsOrigin('', allowedOrigins)).toBe(false);
      expect(validateCorsOrigin('https://example.com', [])).toBe(false);
    });
  });

  describe('createMockWebhookSignature', () => {
    it('should create valid signatures for testing', () => {
      const signature = createMockWebhookSignature(mockPayload, mockSecret);
      
      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
      expect(verifyWebhookSignature(mockPayload, signature, mockSecret)).toBe(true);
    });

    it('should create different signatures for different payloads', () => {
      const payload1 = JSON.stringify({ data: 'test1' });
      const payload2 = JSON.stringify({ data: 'test2' });
      
      const sig1 = createMockWebhookSignature(payload1, mockSecret);
      const sig2 = createMockWebhookSignature(payload2, mockSecret);
      
      expect(sig1).not.toBe(sig2);
    });

    it('should create different signatures for different secrets', () => {
      const sig1 = createMockWebhookSignature(mockPayload, 'secret1');
      const sig2 = createMockWebhookSignature(mockPayload, 'secret2');
      
      expect(sig1).not.toBe(sig2);
    });
  });
});