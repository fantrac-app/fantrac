import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests', timeout: 30000, fullyParallel: false, workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4321/fantrac/' },
  webServer: { command: 'npx vite preview --host 127.0.0.1 --port 4321 --strictPort', url: 'http://127.0.0.1:4321/fantrac/', reuseExistingServer: true },
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 7'] } },
    { name: 'webkit', use: { ...devices['iPhone 14'] } },
  ],
});
