// Vitest must not inherit vite.config.ts (whose root is src/client for the SPA
// build) — API tests live under tests/api and run in plain node.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/api/**/*.test.ts'],
  },
})
