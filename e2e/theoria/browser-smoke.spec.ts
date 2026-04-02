import { expect, test, type Page } from "@playwright/test"

import { cards } from "../../apps/theoria/app/contracts/card.js"
import { encodeEvidenceEventJson, StreamComplete } from "../../apps/theoria/app/contracts/evidence-stream.js"

const envelopeMeta = {
  requestId: "req-browser",
  buildSha: "build-browser",
  durationMs: 1
}

const demoIds = ["effect-text", "effect-search", "effect-math", "effect-dsp"] as const
type DemoId = (typeof demoIds)[number]

const packageVersionsEnvelope = {
  ok: true,
  meta: envelopeMeta,
  data: {
    "effect-text": "0.1.0",
    "effect-search": "0.2.0",
    "effect-math": "0.2.0",
    "effect-dsp": "0.1.4"
  }
}

const isDemoId = (value: string): value is DemoId => demoIds.includes(value as DemoId)

const previewEnvelopeFor = (id: DemoId) => {
  const card = cards.find((candidate) => candidate.id === id)

  if (card === undefined) {
    throw new Error(`Missing card fixture for ${id}`)
  }

  return {
    ok: true,
    meta: envelopeMeta,
    data: {
      id,
      card: {
        id: card.id,
        title: card.title,
        packageName: card.packageName,
        useCase: card.useCase,
        summary: card.summary,
        runLabel: card.runLabel,
        deepDivePath: card.deepDivePath
      },
      summary: card.summary,
      program: {
        files: [{
          language: "ts",
          entry: "server/run.ts",
          name: "run.ts",
          source: `export const run = Effect.succeed(${JSON.stringify(id)})`
        }]
      }
    }
  }
}

const installMockEventSource = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    class MockEventSource {
      static instances: Array<MockEventSource> = []

      listeners: Record<string, Array<(event: Event | MessageEvent<string>) => void>> = {}
      closed = false
      url: string

      constructor(url: string | URL) {
        this.url = String(url)
        MockEventSource.instances = [...MockEventSource.instances, this]
      }

      addEventListener(type: string, listener: (event: Event | MessageEvent<string>) => void): void {
        this.listeners[type] = [...(this.listeners[type] ?? []), listener]
      }

      close(): void {
        this.closed = true
      }

      dispatchEvidence(data: string): void {
        ;(this.listeners.evidence ?? []).forEach((listener) => listener(new MessageEvent("evidence", { data })))
      }
    }

    const root = globalThis as typeof globalThis & {
      __theoriaEventSourceMock: {
        emitEvidence: (data: string) => void
        openCount: () => number
      }
      EventSource: typeof EventSource
    }

    root.__theoriaEventSourceMock = {
      emitEvidence: (data: string) => {
        MockEventSource.instances.filter((source) => source.closed === false).forEach((source) => {
          source.dispatchEvidence(data)
        })
      },
      openCount: () => MockEventSource.instances.filter((source) => source.closed === false).length
    }

    root.EventSource = MockEventSource as unknown as typeof EventSource
  })
}

const routeApi = async (page: Page): Promise<void> => {
  await page.route("**/api/versions/packages", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: packageVersionsEnvelope,
      status: 200
    })
  })

  await page.route("**/api/demos/*/preload", async (route) => {
    const url = new URL(route.request().url())
    const match = /^\/api\/demos\/([^/]+)\/preload$/u.exec(url.pathname)

    const id = match !== null ? match[1] : undefined

    if (id === undefined || !isDemoId(id)) {
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: false,
          meta: envelopeMeta,
          error: {
            code: "not-found",
            message: `Unknown preload route: ${url.pathname}`,
            retryable: false
          }
        },
        status: 404
      })
      return
    }

    await route.fulfill({
      contentType: "application/json",
      json: previewEnvelopeFor(id),
      status: 200
    })
  })
}

const attachBrowserFailureCapture = (page: Page) => {
  const consoleErrors: Array<string> = []
  const pageErrors: Array<string> = []

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })

  page.on("pageerror", (error) => {
    pageErrors.push(error.message)
  })

  return { consoleErrors, pageErrors }
}

const transformedAncestor = (element: Element): string => {
  let current: Element | null = element

  while (current !== null) {
    const transform = getComputedStyle(current).transform

    if (transform !== "none") {
      return transform
    }

    current = current.parentElement
  }

  return "none"
}

test("deep dive run controls survive pause-resume in a real browser", async ({ page }) => {
  const failures = attachBrowserFailureCapture(page)

  await installMockEventSource(page)
  await routeApi(page)
  await page.goto("/demos/effect-search")

  const runButton = page.getByRole("button", { name: /Run/i })
  await expect(runButton).toBeVisible()
  await runButton.click()

  const pauseButton = page.getByRole("button", { name: /Pause/i })
  await expect(pauseButton).toBeVisible()
  await pauseButton.click()

  const resumeButton = page.getByRole("button", { name: /Resume/i })
  await expect(resumeButton).toBeVisible()
  await resumeButton.click()

  await expect(pauseButton).toBeVisible()
  await expect.poll(async () =>
    page.evaluate(() => {
      const root = globalThis as typeof globalThis & {
        __theoriaEventSourceMock: { openCount: () => number }
      }

      return root.__theoriaEventSourceMock.openCount()
    })
  ).toBeGreaterThan(0)

  await page.evaluate((payload) => {
    const root = globalThis as typeof globalThis & {
      __theoriaEventSourceMock: { emitEvidence: (data: string) => void }
    }

    root.__theoriaEventSourceMock.emitEvidence(payload)
  }, encodeEvidenceEventJson(new StreamComplete({ summary: "Browser smoke complete.", meta: envelopeMeta })))

  await expect(runButton).toBeVisible()
  expect(failures.consoleErrors).toEqual([])
  expect(failures.pageErrors).toEqual([])
})

test("home InstrumentCard hover survives reversal and navigation in a real browser", async ({ page }) => {
  const failures = attachBrowserFailureCapture(page)

  await routeApi(page)
  await page.goto("/")

  const effectSearchLink = page.getByRole("link", { name: "effect-search" }).first()
  await expect(effectSearchLink).toBeVisible()

  await effectSearchLink.hover()
  await expect.poll(async () => effectSearchLink.evaluate(transformedAncestor)).not.toBe("none")

  await page.mouse.move(1, 1)
  await expect.poll(async () => effectSearchLink.evaluate(transformedAncestor)).toBe("none")

  await effectSearchLink.hover()
  await expect.poll(async () => effectSearchLink.evaluate(transformedAncestor)).not.toBe("none")

  await effectSearchLink.click()
  await expect(page.getByRole("button", { name: /Run/i })).toBeVisible()
  expect(failures.consoleErrors).toEqual([])
  expect(failures.pageErrors).toEqual([])
})
