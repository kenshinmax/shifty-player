import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    // A dedicated dev server so tests never reuse (and reseed) a developer's
    // server on :3000. Its own distDir lets it run alongside that server.
    command: `npm run dev -- --port ${E2E_PORT}`,
    url: `http://127.0.0.1:${E2E_PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    // Empty values take precedence over .env.local, so tests use the
    // in-memory store, skip HubSpot, and use the demo checkout.
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      MONGODB_URI: "",
      MONGODB_DB: "",
      HUBSPOT_ACCESS_TOKEN: "",
      STRIPE_SECRET_KEY: "",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
