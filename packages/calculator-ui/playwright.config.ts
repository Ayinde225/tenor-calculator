import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests drive the real app in Chromium against the Vite dev server.
 *
 * The engine already has deep unit coverage; these tests cover the layer the unit
 * tests can't reach — that button presses, the keyboard, guided mode, history,
 * theming, and persistence actually behave in a browser. They assert the same
 * displayed strings the golden corpus does, now produced end-to-end through the UI.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5181',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5181 --strictPort',
    url: 'http://localhost:5181',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
