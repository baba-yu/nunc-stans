import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // The suite leans on real sqlite DBs and template copies; the
    // GitHub windows runner needs seconds per initDb/initInstance, so
    // the 5s default kills half the integration tests there.
    testTimeout: 120_000,
  },
});
