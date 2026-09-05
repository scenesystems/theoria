import {
  type Browser as PlaywrightBrowser,
  type BrowserContext,
  chromium,
  expect as inBrowser,
  type Locator,
  type Page,
  type Response
} from "@playwright/test"
import { Chunk, Context, Data, Effect, Layer, Predicate, Queue, Schema, type Scope } from "effect"

import {
  distinctTextColours,
  documentFitsViewport,
  elementsPastViewport,
  finiteAnimationsFinished
} from "./platform/in-page.js"
import { Site } from "./site.js"

/**
 * Playwright, driven from Effect. Every browser call is one `act`, which
 * turns a rejected Playwright promise into a `BrowserError` carrying
 * Playwright's message. Playwright's own auto-retrying assertions are wrapped
 * the same way, so a failed expectation or timeout fails the test with the
 * message intact.
 */

/** A Playwright call that rejected: a failed assertion, a timeout, or a browser fault. */
export class BrowserError extends Data.TaggedError("test/worker/BrowserError")<{
  readonly message: string
  readonly cause: unknown
}> {}

/** Runs one Playwright call. */
export const act = <A>(run: () => Promise<A>): Effect.Effect<A, BrowserError> =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new BrowserError({ message: Predicate.isError(cause) ? cause.message : String(cause), cause })
  })

export class Browser extends Context.Tag("test/worker/Browser")<Browser, PlaywrightBrowser>() {}

/**
 * Chromium for the whole layer. Nothing in a test can respond to the browser
 * failing to close, so that failure surfaces as a defect in the scope's exit.
 */
export const BrowserLive: Layer.Layer<Browser, BrowserError> = Layer.scoped(
  Browser,
  Effect.acquireRelease(
    act(() => chromium.launch()),
    (browser) => Effect.orDie(act(() => browser.close()))
  )
)

export const Viewport = Schema.Struct({ width: Schema.Number, height: Schema.Number })
export type Viewport = typeof Viewport.Type
export const desktop: Viewport = { width: 1280, height: 800 }

export class Session extends Data.Class<{
  readonly page: Page
  readonly context: BrowserContext
  /** Console errors and uncaught page errors seen so far; taking them clears the buffer. */
  readonly failures: Effect.Effect<ReadonlyArray<string>>
}> {}

/** Opens an isolated browser context on the site for the rest of the scope. */
export const openPage = (
  options: { readonly viewport?: Viewport; readonly permissions?: ReadonlyArray<string> } = {}
): Effect.Effect<Session, BrowserError, Browser | Site | Scope.Scope> =>
  Effect.gen(function*() {
    const browser = yield* Browser
    const site = yield* Site
    const context = yield* Effect.acquireRelease(
      act(() => browser.newContext({ baseURL: site.url, viewport: options.viewport ?? desktop })),
      (open) => Effect.orDie(act(() => open.close()))
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

    return new Session({ page, context, failures: Queue.takeAll(failures).pipe(Effect.map(Chunk.toReadonlyArray)) })
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
export const hover = (locator: Locator) => act(() => locator.hover())
export const focus = (locator: Locator) => act(() => locator.focus())
export const press = (page: Page, key: string) => act(() => page.keyboard.press(key))
export const fill = (locator: Locator, value: string) => act(() => locator.fill(value))
export const setViewport = (page: Page, viewport: Viewport) => act(() => page.setViewportSize(viewport))

export const visible = (locator: Locator) => act(() => inBrowser(locator).toBeVisible())
export const hidden = (locator: Locator) => act(() => inBrowser(locator).toBeHidden())
export const count = (locator: Locator, expected: number) => act(() => inBrowser(locator).toHaveCount(expected))
export const containsText = (locator: Locator, expected: string | RegExp) =>
  act(() => inBrowser(locator).toContainText(expected))
export const attribute = (locator: Locator, name: string, expected: string | RegExp) =>
  act(() => inBrowser(locator).toHaveAttribute(name, expected))
export const urlMatches = (page: Page, pattern: RegExp) => act(() => inBrowser(page).toHaveURL(pattern))

/** Waits for the next response whose URL ends with `suffix` from a request with `method`. */
export const nextResponse = (page: Page, method: string, suffix: string): Effect.Effect<Response, BrowserError> =>
  act(() =>
    page.waitForResponse((response) => response.url().endsWith(suffix) && response.request().method() === method)
  )

export const attached = (locator: Locator) => act(() => inBrowser(locator).toBeAttached())
export const eventually = <A>(read: () => Promise<A>, expected: A) => act(() => inBrowser.poll(read).toBe(expected))

/**
 * Syntax highlighting is visible: the code paints its tokens in more than one
 * colour. The highlighter loads after first render, so this retries until the
 * colours appear or Playwright's assertion timeout elapses.
 */
export const highlighted = (code: Locator): Effect.Effect<void, BrowserError> =>
  act(() => inBrowser.poll(() => code.evaluate(distinctTextColours)).toBeGreaterThan(1))

/** True when the document does not scroll horizontally at the current viewport. */
export const fitsViewport = (page: Page) => act(() => page.evaluate(documentFitsViewport))

/**
 * Waits until every finite animation on the page (CSS animations and
 * transitions, and Motion's Web Animations) has finished, so geometry is
 * measured at rest rather than mid-flight after a viewport change.
 */
export const animationsSettled = (page: Page) =>
  Effect.asVoid(act(() => page.waitForFunction(finiteAnimationsFinished)))

/** Elements that leak past the viewport; see `elementsPastViewport`. */
export const overflowingElements = (page: Page) => act(() => page.evaluate(elementsPastViewport))
