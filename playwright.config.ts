import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5180",
    ...devices["Desktop Chrome"],
    channel: process.env.CI ? undefined : "chrome",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5180",
    env: {
      API_PORT: "3002",
      BASE_URL: "http://localhost:5180",
      WORKFLOW_DB: `test-results/browser-${process.pid}.sqlite`,
      PAYMENT_MODE: "fps_test",
      ENABLE_TEST_CLOCK: "true",
      SMTP_HOST: "",
      STRIPE_SECRET_KEY: "",
      WORKFLOW_ADMIN_KEY: "",
      AUTH_MODE: "local",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    },
    url: "http://localhost:5180",
    reuseExistingServer: false,
  },
});
