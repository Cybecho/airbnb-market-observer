import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 1000 },
    // The Pages workflow uses the actual browser shipped in the hosted Ubuntu image.
    ...(process.env.AMO_HOSTED_CHROME === '/usr/bin/google-chrome' ? {launchOptions: {executablePath: '/usr/bin/google-chrome'}} : {}),
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
