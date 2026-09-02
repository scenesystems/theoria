import { defineConfig, devices } from "@playwright/test"

const baseUrl = "http://127.0.0.1:5175"
// Vite proxies `/api` to this port (see apps/theoria/vite.config.ts).
const apiPort = "3876"
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
  webServer: [
    {
      // The Bun API server; the home page builds its demo through it.
      command: "bun run --filter @theoria/theoria-app dev",
      env: { PORT: apiPort, THEORIA_PORT: apiPort },
      url: `http://127.0.0.1:${apiPort}/api/health/live`,
      reuseExistingServer: !isCI,
      timeout: 120_000
    },
    {
      command: "bun run --filter @theoria/theoria-app dev:web",
      env: { THEORIA_PORT: apiPort },
      url: baseUrl,
      reuseExistingServer: !isCI,
      timeout: 120_000
    }
  ]
})
