/**
 * Tests for github-dispatch-check utility
 */

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
    
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/actions/workflows',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer token123'
        })
      })
    );
  });

  it('should throw INSUFFICIENT_PERMISSIONS error for 403 response', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        text: async () => 'Resource not accessible by personal access token'
      };
      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

    await expect(assertWorkflowDispatchable('owner/repo', 'token123'))
      .rejects
      .toThrow(/403 listing workflows/);

    try {
      await assertWorkflowDispatchable('owner/repo', 'token123');
    } catch (error: any) {
      expect(error.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(error.suggestions).toContain('Verify your token has the "workflow" scope (classic PAT) or "Actions: Read and write" permission (fine-grained PAT)');
    }
  });

  it('should throw INSUFFICIENT_PERMISSIONS error for 404 response', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      text: async () => 'Not Found'
    };
    global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

    await expect(assertWorkflowDispatchable('owner/repo', 'token123'))
      .rejects
      .toThrow(/Repository owner\/repo not found/);

    try {
      await assertWorkflowDispatchable('owner/repo', 'token123');
    } catch (error: any) {
      expect(error.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(error.suggestions).toContain('Verify the repository name is correct');
    }
  });

  it('should throw MISSING_WORKFLOW error when specific workflow not found', async () => {
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

    try {
      await assertWorkflowDispatchable('owner/repo', 'token123', 'codeql.yml');
    } catch (error: any) {
      expect(error.code).toBe('MISSING_WORKFLOW');
      expect(error.suggestions).toContain('Ensure the workflow file exists at .github/workflows/codeql.yml');
    }
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

    try {
      await assertWorkflowDispatchable('owner/repo', 'token123');
    } catch (error: any) {
      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.suggestions).toContain('Check network connectivity and GitHub API status');
    }
  });
});