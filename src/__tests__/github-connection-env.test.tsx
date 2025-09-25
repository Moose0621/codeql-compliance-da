import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

describe('GitHubConnection env-managed mode', () => {
  beforeEach(() => {
    vi.resetModules();
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}), text: async () => '' });
  });

  it('initializes as connected when env vars present and hides disconnect', async () => {
    (globalThis as any).__TEST_ENV_CONFIG__ = { token: 'env_pat', org: 'env_org' };
    const { GitHubConnection } = await import('../components/GitHubConnection');
    const html = renderToString(<GitHubConnection onConnectionChange={async () => { /* no-op */ }} />);
    expect(html).toContain('env_org');
    expect(html).toContain('(Connection managed via environment variables)');
    expect(html).not.toContain('Disconnect');
  }, 15000);

  it('shows manual setup when env vars missing', async () => {
    (globalThis as any).__TEST_ENV_CONFIG__ = { token: undefined, org: undefined };
    const { GitHubConnection } = await import('../components/GitHubConnection');
    const html = renderToString(<GitHubConnection onConnectionChange={async () => { /* no-op */ }} />);
    expect(html).toContain('Connect to GitHub');
    expect(html).not.toContain('(Connection managed via environment variables)');
  }, 10000);
});
