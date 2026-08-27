import { expect, test, type Page } from "@playwright/test"

import { cards } from "../../apps/theoria/app/contracts/card.js"
import { encodeEvidenceEventJson, StreamComplete } from "../../apps/theoria/app/contracts/evidence-stream.js"

const envelopeMeta = {
  requestId: "req-browser",
  buildSha: "build-browser",
  durationMs: 1
}

const demoIds = [
  "effect-text",
  "effect-search",
  "effect-math",
  "effect-dsp",
  "digest",
  "sign",
  "seal"
] as const
type DemoId = (typeof demoIds)[number]

const packageVersionsEnvelope = {
  ok: true,
  meta: envelopeMeta,
  data: {
    "@scenesystems/effect-text": "0.1.0",
    "@scenesystems/effect-search": "0.2.0",
    "@scenesystems/effect-math": "0.2.0",
    "@scenesystems/effect-dsp": "0.1.4",
    "@scenesystems/digest": "0.2.0",
    "@scenesystems/sign": "0.1.0",
    "@scenesystems/seal": "0.1.0"
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

const runEnvelopeFor = (id: DemoId) => ({
  ok: true,
  meta: envelopeMeta,
  data: {
    id,
    packageName: previewEnvelopeFor(id).data.card.packageName,
    summary: "Browser smoke complete.",
    durationMs: 1,
    program: previewEnvelopeFor(id).data.program,
    sections: [{
      title: "Browser result",
      items: [{
        _tag: "Text",
        label: "Result",
        value: "Verified"
      }]
    }]
  }
})

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

  await page.route("**/api/demos/*/run", async (route) => {
    const url = new URL(route.request().url())
    const match = /^\/api\/demos\/([^/]+)\/run$/u.exec(url.pathname)
    const id = match !== null ? match[1] : undefined

    if (id === undefined || !isDemoId(id)) {
      await route.fulfill({ status: 404 })
      return
    }

    await route.fulfill({
      contentType: "application/json",
      json: runEnvelopeFor(id),
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

test("home package catalog remains complete across responsive widths", async ({ page }) => {
  const failures = attachBrowserFailureCapture(page)

  await page.setViewportSize({ width: 320, height: 800 })
  await routeApi(page)
  await page.goto("/")

  const packageTitles = page.getByRole("heading", { level: 3 })
  const effectSearchTitle = page.getByRole("heading", {
    level: 3,
    name: "@scenesystems/effect-search"
  })

  await expect(packageTitles).toHaveCount(cards.length)
  await expect(effectSearchTitle).toBeVisible()
  await expect(page.locator('a[href^="/demos/"]')).toHaveCount(0)
  await expect(page.getByText("Live demo", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Demo in development", { exact: true })).toHaveCount(0)

  await effectSearchTitle.hover()
  await expect.poll(async () => effectSearchTitle.evaluate(transformedAncestor)).not.toBe("none")

  await page.mouse.move(1, 1)
  await expect.poll(async () => effectSearchTitle.evaluate(transformedAncestor)).toBe("none")

  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 })

    const layout = await page.locator("h3 + p").evaluateAll((descriptions) => ({
      descriptions: descriptions.map((description) => ({
        clientHeight: description.clientHeight,
        scrollHeight: description.scrollHeight
      })),
      titles: [...document.querySelectorAll("h3")].map((title) => {
        const range = document.createRange()
        range.selectNodeContents(title)

        return {
          lineCount: range.getClientRects().length,
          overflows: title.scrollWidth > title.clientWidth,
          whiteSpace: getComputedStyle(title).whiteSpace
        }
      })
    }))

    expect(layout.descriptions).toHaveLength(cards.length)
    expect(layout.descriptions.every((description) => description.scrollHeight <= description.clientHeight)).toBe(true)
    expect(layout.titles.every((title) => title.lineCount === 1)).toBe(true)
    expect(layout.titles.every((title) => title.overflows === false)).toBe(true)
    expect(layout.titles.every((title) => title.whiteSpace === "nowrap")).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }

  expect(failures.consoleErrors).toEqual([])
  expect(failures.pageErrors).toEqual([])
})

test("server-only demos project completed evidence into view", async ({ page }) => {
  const failures = attachBrowserFailureCapture(page)

  await page.setViewportSize({ width: 900, height: 800 })
  await routeApi(page)
  await page.goto("/demos/digest")

  await page.getByRole("button", { name: "Run Digest Demo" }).click()

  await expect(page.getByRole("button", { name: /Projection field: 1 of .*Evidence/u })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Browser result" })).toBeVisible()
  expect(failures.consoleErrors).toEqual([])
  expect(failures.pageErrors).toEqual([])
})
