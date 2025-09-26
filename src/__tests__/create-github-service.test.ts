import { describe, it, expect } from 'vitest';
import { createGitHubService, GitHubService } from '@/lib/github-service';

describe('createGitHubService factory', () => {
  it('creates a GitHubService instance', () => {
    const svc = createGitHubService('token123', 'my-org');
    expect(svc).toBeInstanceOf(GitHubService);
  });
});
