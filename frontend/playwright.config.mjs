import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start:e2e',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      ...process.env,
      VITE_API_URL: 'http://localhost:5001',
      VITE_AUTH_MODE: 'local',
      VITE_LOCAL_AUTH_TOKEN: 'marketmind-local-development',
      VITE_LOCAL_AUTH_USER_ID: 'e2e_user',
    },
  },
});
