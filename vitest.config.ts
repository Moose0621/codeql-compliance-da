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
    include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      'tests/e2e/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/lib/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx', 
        'src/App.tsx', 
        'src/**/*.d.ts',
        'src/**/*.stories.{ts,tsx}',
        'src/components/ui/**/*.{ts,tsx}' // Exclude Radix UI components
      ],
      thresholds: {
        lines: 90,
        functions: 85,
        branches: 80,
        statements: 90
      },
      // Quality gate: fail if coverage drops below thresholds
      skipFull: false,
      watermarks: {
        statements: [80, 95],
        functions: [80, 95],
        branches: [75, 90],
        lines: [80, 95]
      }
    }
  }
});
