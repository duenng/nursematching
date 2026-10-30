import { defineConfig, devices } from "@playwright/test";

const browserPort = process.env.PLAYWRIGHT_PORT || "5180";
const apiPort = process.env.PLAYWRIGHT_API_PORT || "3002";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${browserPort}`,
    ...devices["Desktop Chrome"],
    channel: process.env.CI ? undefined : "chrome",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run dev -- --port ${browserPort}`,
    env: {
      API_PORT: apiPort,
      WORKSPACE_MODE: "live",
      BASE_URL: `http://localhost:${browserPort}`,
      WORKFLOW_DB: `test-results/browser-${process.pid}.sqlite`,
      PAYMENT_MODE: "bank_transfer",
      ENABLE_TEST_CLOCK: "false",
      SMTP_HOST: "",
      BANK_NAME: "Test bank",
      BANK_ACCOUNT_NAME: "Test organisation",
      BANK_ACCOUNT_NUMBER: "000-TEST",
      STRIPE_SECRET_KEY: "",
      WORKFLOW_ADMIN_KEY: "",
      AUTH_MODE: "local",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    },
    url: `http://localhost:${browserPort}`,
    reuseExistingServer: false,
  },
});
