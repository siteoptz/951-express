import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'server-only': path.resolve(__dirname, 'test/stubs/server-only.ts'),
    },
  },
  test: {
    // The database tests share one dev branch, and the seed test briefly changes real settings (the deposit, a route's
    // capacity) that the checkout tests read. Run the files one at a time so they can never see each other's changes.
    fileParallelism: false,
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts'],
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 95 },
    },
  },
});
