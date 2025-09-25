import { describe, it, expect, beforeEach } from 'vitest';
import { getEnvConfig } from '@/lib/env-config';

type TestEnvConfig = { token?: string; org?: string };
declare global {
  // eslint-disable-next-line no-var
  var __TEST_ENV_CONFIG__: TestEnvConfig | undefined; // NOSONAR - test-only global shim
}

// Helper to mutate import.meta.env safely without suppressing TS diagnostics
function setImportMetaEnv(vars: Record<string, string | undefined>) {
  const meta: any = import.meta as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  meta.env = meta.env || {};
  Object.assign(meta.env, vars);
}

describe('getEnvConfig', () => {
  beforeEach(() => {
  delete globalThis.__TEST_ENV_CONFIG__;
  });

  it('prefers injected test config over import.meta.env', () => {
  globalThis.__TEST_ENV_CONFIG__ = { token: 'override_token', org: 'override_org' };
    setImportMetaEnv({ VITE_GITHUB_TOKEN: 'ignored', VITE_GITHUB_ORG: 'ignored' });
    const cfg = getEnvConfig();
    expect(cfg.token).toBe('override_token');
    expect(cfg.org).toBe('override_org');
  });

  it('falls back to import.meta.env variables when no override present', () => {
    setImportMetaEnv({ VITE_GITHUB_TOKEN: 'env_token', VITE_GITHUB_ORG: 'env_org' });
    const cfg = getEnvConfig();
    expect(cfg.token).toBe('env_token');
    expect(cfg.org).toBe('env_org');
  });

  it('returns undefined values gracefully when nothing set', () => {
    setImportMetaEnv({ VITE_GITHUB_TOKEN: undefined, VITE_GITHUB_ORG: undefined });
    // Some environments may coerce absent vars to string 'undefined'; treat both as empty.
    const cfg = getEnvConfig();
    expect(cfg.token === undefined || cfg.token === 'undefined').toBe(true);
    expect(cfg.org === undefined || cfg.org === 'undefined').toBe(true);
  });
});
