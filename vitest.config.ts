import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/lib/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/App.tsx'],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50
      }
    }
  }
});
