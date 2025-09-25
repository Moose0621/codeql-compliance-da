// Allow tests to inject a synthetic environment configuration via global.
declare const globalThis: any; // eslint-disable-line @typescript-eslint/no-explicit-any

export function getEnvConfig() {
  if (typeof globalThis !== 'undefined' && globalThis.__TEST_ENV_CONFIG__) {
    return globalThis.__TEST_ENV_CONFIG__ as { token?: string; org?: string };
  }
  return {
    token: import.meta.env.VITE_GITHUB_TOKEN as string | undefined,
    org: import.meta.env.VITE_GITHUB_ORG as string | undefined,
  };
}
