import { defineConfig, devices } from "@playwright/test"

const baseUrl = "http://localhost:5175"
const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts$/u,
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  retries: isCI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: baseUrl,
    screenshot: "only-on-failure",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"]
      }
    }
  ],
  webServer: {
    command: "bun run --filter @theoria/theoria-app dev:web",
    url: baseUrl,
    reuseExistingServer: !isCI,
    timeout: 120_000
  }
})
