import {
  type Browser as PlaywrightBrowser,
  type BrowserContext,
  chromium,
  expect as inBrowser,
  type Locator,
  type Page,
  type Response
} from "@playwright/test"
import { Chunk, Context, Effect, Layer, Queue, type Scope } from "effect"

import { Site } from "./site.js"

/**
 * Playwright, driven from Effect. Every browser call is one `Effect.promise`;
 * Playwright's own auto-retrying assertions are wrapped the same way, so a
 * failed expectation or timeout fails the test as a defect with Playwright's
 * message intact.
 */

export class Browser extends Context.Tag("test/worker/Browser")<Browser, PlaywrightBrowser>() {}

export const BrowserLive = Layer.scoped(
  Browser,
  Effect.acquireRelease(
    Effect.promise(() => chromium.launch()),
    (browser) => Effect.promise(() => browser.close())
  )
)

/** Runs one Playwright call. */
export const act = <A>(run: () => Promise<A>): Effect.Effect<A> => Effect.promise(run)

export type Viewport = { readonly width: number; readonly height: number }
export const desktop: Viewport = { width: 1280, height: 800 }

export type Session = {
  readonly page: Page
  readonly context: BrowserContext
  /** Console errors and uncaught page errors seen so far; taking them clears the buffer. */
  readonly failures: Effect.Effect<ReadonlyArray<string>>
}

/** Opens an isolated browser context on the site for the rest of the scope. */
export const openPage = (
  options: { readonly viewport?: Viewport; readonly permissions?: ReadonlyArray<string> } = {}
): Effect.Effect<Session, never, Browser | Site | Scope.Scope> =>
  Effect.gen(function*() {
    const browser = yield* Browser
    const site = yield* Site
    const context = yield* Effect.acquireRelease(
      act(() => browser.newContext({ baseURL: site.url, viewport: options.viewport ?? desktop })),
      (open) => act(() => open.close())
    )
    yield* act(() => context.grantPermissions([...(options.permissions ?? [])]))
    const page = yield* act(() => context.newPage())

    const failures = yield* Queue.unbounded<string>()
    page.on("console", (message) => {
      if (message.type() === "error") Queue.unsafeOffer(failures, message.text())
    })
    page.on("pageerror", (error) => {
      Queue.unsafeOffer(failures, error.message)
    })

    return { page, context, failures: Queue.takeAll(failures).pipe(Effect.map(Chunk.toReadonlyArray)) }
  })

/** Records the URL of every request that passes `keep`; taking them clears the buffer. */
export const observeRequests = (
  page: Page,
  keep: (request: { readonly url: string; readonly resourceType: string }) => boolean
): Effect.Effect<Effect.Effect<ReadonlyArray<string>>> =>
  Effect.map(Queue.unbounded<string>(), (seen) => {
    page.on("request", (request) => {
      if (keep({ url: request.url(), resourceType: request.resourceType() })) Queue.unsafeOffer(seen, request.url())
    })
    return Queue.takeAll(seen).pipe(Effect.map(Chunk.toReadonlyArray))
  })

export const goto = (page: Page, path: string) => act(() => page.goto(path))
export const click = (locator: Locator) => act(() => locator.click())
export const fill = (locator: Locator, value: string) => act(() => locator.fill(value))
export const setViewport = (page: Page, viewport: Viewport) => act(() => page.setViewportSize(viewport))

export const visible = (locator: Locator) => act(() => inBrowser(locator).toBeVisible())
export const hidden = (locator: Locator) => act(() => inBrowser(locator).toBeHidden())
export const count = (locator: Locator, expected: number) => act(() => inBrowser(locator).toHaveCount(expected))
export const someCount = (locator: Locator) => act(() => inBrowser(locator).not.toHaveCount(0))
export const containsText = (locator: Locator, expected: string | RegExp) =>
  act(() => inBrowser(locator).toContainText(expected))
export const attribute = (locator: Locator, name: string, expected: string) =>
  act(() => inBrowser(locator).toHaveAttribute(name, expected))
export const urlMatches = (page: Page, pattern: RegExp) => act(() => inBrowser(page).toHaveURL(pattern))

/** Waits for the next response whose URL ends with `suffix` from a request with `method`. */
export const nextResponse = (page: Page, method: string, suffix: string): Effect.Effect<Response> =>
  act(() =>
    page.waitForResponse((response) => response.url().endsWith(suffix) && response.request().method() === method)
  )

/** True when the document does not scroll horizontally at the current viewport. */
export const fitsViewport = (page: Page) =>
  act(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
