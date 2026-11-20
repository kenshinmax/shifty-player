import { defineConfig } from "@playwright/test";
import localConfig from "./playwright.config";
import { getDisposableStagingOrigin } from "./e2e/staging-environment";

export default defineConfig({
  ...localConfig,
  // No local server or environment overrides: staging is configured by its owner.
  webServer: undefined,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    ...localConfig.use,
    baseURL: getDisposableStagingOrigin(process.env),
    // Do not persist customer/session data from remote tests in trace archives.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
