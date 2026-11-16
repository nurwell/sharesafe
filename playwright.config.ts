import { defineConfig, devices } from '@playwright/test';
const production = process.env.TEST_PRODUCTION === '1';
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1, timeout: 60000,
  testMatch: production ? '**/production.spec.ts' : '**/*.spec.ts',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL },
  webServer: { command: production ? 'npm run preview -- --port 5173' : 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: !production && !process.env.CI },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
