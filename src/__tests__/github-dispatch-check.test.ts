import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assertWorkflowDispatchable } from '../lib/github-dispatch-check';

describe('assertWorkflowDispatchable', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should pass when workflow listing is successful', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        workflows: [
          { id: 123, name: 'CodeQL', path: '.github/workflows/codeql.yml' }
        ]
      })
    };
    global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

    await expect(assertWorkflowDispatchable('owner/repo', 'token123')).resolves.not.toThrow();
  });

  it('should throw error for 403 response', async () => {
    const mockResponse = {
      ok: false,
      status: 403,
      text: async () => 'Resource not accessible by personal access token'
    };
    global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

    await expect(assertWorkflowDispatchable('owner/repo', 'token123'))
      .rejects
      .toThrow(/403 listing workflows/);
  });

  it('should throw error for 404 response', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      text: async () => 'Not Found'
    };
    global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

    await expect(assertWorkflowDispatchable('owner/repo', 'token123'))
      .rejects
      .toThrow(/Repository owner\/repo not found/);
  });

  it('should throw error when specific workflow not found', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        workflows: [
          { id: 456, name: 'CI', path: '.github/workflows/ci.yml' }
        ]
      })
    };
    global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

    await expect(assertWorkflowDispatchable('owner/repo', 'token123', 'codeql.yml'))
      .rejects
      .toThrow(/Workflow codeql.yml not found/);
  });

  it('should succeed when specific workflow is found', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        workflows: [
          { id: 123, name: 'CodeQL', path: '.github/workflows/codeql.yml' }
        ]
      })
    };
    global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

    await expect(assertWorkflowDispatchable('owner/repo', 'token123', 'codeql.yml'))
      .resolves.not.toThrow();
  });

  it('should handle network errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    await expect(assertWorkflowDispatchable('owner/repo', 'token123'))
      .rejects
      .toThrow(/Network error during workflow dispatch check/);
  });
});