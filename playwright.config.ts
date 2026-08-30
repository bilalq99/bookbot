import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3111',
    launchOptions: {
      // Preinstalled Chromium in this environment; never run `playwright install`.
      executablePath: '/opt/pw-browsers/chromium',
    },
  },
  webServer: {
    command: 'node dist/server/index.js',
    port: 3111,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: '3111',
      DB_PATH: 'data/e2e.db',
      UPLOADS_DIR: 'uploads-e2e',
    },
  },
})
