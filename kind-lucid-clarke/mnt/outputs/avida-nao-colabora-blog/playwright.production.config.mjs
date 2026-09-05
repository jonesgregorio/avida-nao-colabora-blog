import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'production-smoke.spec.mjs',
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: 'line',
  timeout: 45_000,
  use: {
    baseURL: process.env.PRODUCTION_BASE_URL || 'https://avidanaocolabora.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
})
