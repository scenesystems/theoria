import {
  type Browser as PlaywrightBrowser,
  type BrowserContext,
  chromium,
  expect as inBrowser,
  type Locator,
  type Page,
  type Response
} from "@playwright/test"
import { Chunk, Context, Data, Effect, Layer, Predicate, Queue, Ref, Schedule, Schema, type Scope } from "effect"
import * as Arr from "effect/Array"

import {
  distinctTextColours,
  documentFitsViewport,
  elementsPastViewport,
  finiteAnimationsFinished,
  scrollY
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

export class Browser extends Context.Tag("test/worker/Browser")<Browser, {
  readonly chromium: PlaywrightBrowser
  /** How many visitors this browser has opened pages for; each page is a visitor of its own. */
  readonly visitors: Ref.Ref<number>
}>() {}

/**
 * Chromium for the whole layer. Nothing in a test can respond to the browser
 * failing to close, so that failure surfaces as a defect in the scope's exit.
 */
export const BrowserLive: Layer.Layer<Browser, BrowserError> = Layer.scoped(
  Browser,
  Effect.all({
    chromium: Effect.acquireRelease(
      act(() => chromium.launch()),
      (browser) => Effect.orDie(act(() => browser.close()))
    ),
    visitors: Ref.make(0)
  })
)

/**
 * The address the Worker sees a page's requests from. Cloudflare sets
 * `cf-connecting-ip` on every request at the edge, and the place build's
 * limiter keys its budget by it; every page a test opens is a visitor of its
 * own, with its own budget, as visitors are — so a suite's builds are never
 * summed into one address. Addresses are drawn from TEST-NET-3
 * (203.0.113.0/24) and the documentation nets above it.
 */
const visitorAddress = (visitor: number): string =>
  `203.0.${String(113 + Math.floor(visitor / 256))}.${String(visitor % 256)}`

export const Viewport = Schema.Struct({ width: Schema.Number, height: Schema.Number })
export type Viewport = typeof Viewport.Type
export const desktop: Viewport = { width: 1280, height: 800 }
export const phone: Viewport = { width: 390, height: 844 }

export class Session extends Data.Class<{
  readonly page: Page
  readonly context: BrowserContext
  /** Console errors and uncaught page errors seen so far; taking them clears the buffer. */
  readonly failures: Effect.Effect<ReadonlyArray<string>>
}> {}

/** Opens an isolated browser context on the site for the rest of the scope. */
/** The reader's system motion setting the context reports; `no-preference` unless a test asks otherwise. */
export const ReducedMotion = Schema.Literal("reduce", "no-preference")
export type ReducedMotion = typeof ReducedMotion.Type
export const ForcedColors = Schema.Literal("active", "none")
export type ForcedColors = typeof ForcedColors.Type

export const openPage = (
  options: {
    readonly viewport?: Viewport
    readonly permissions?: ReadonlyArray<string>
    readonly reducedMotion?: ReducedMotion
    readonly forcedColors?: ForcedColors
    readonly colorScheme?: ColorScheme
  } = {}
): Effect.Effect<Session, BrowserError, Browser | Site | Scope.Scope> =>
  Effect.gen(function*() {
    const browser = yield* Browser
    const site = yield* Site
    const visitor = yield* Ref.getAndUpdate(browser.visitors, (count) => count + 1)
    const context = yield* Effect.acquireRelease(
      act(() =>
        browser.chromium.newContext({
          baseURL: site.url,
          viewport: options.viewport ?? desktop,
          reducedMotion: options.reducedMotion ?? "no-preference",
          forcedColors: options.forcedColors ?? "none",
          colorScheme: options.colorScheme ?? "light",
          extraHTTPHeaders: { "cf-connecting-ip": visitorAddress(visitor) }
        })
      ),
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
/** Turns the mouse wheel over whatever is under the pointer, the way a trackpad swipe does. */
export const wheel = (page: Page, deltaX: number, deltaY: number) => act(() => page.mouse.wheel(deltaX, deltaY))
export const fill = (locator: Locator, value: string) => act(() => locator.fill(value))
export const setViewport = (page: Page, viewport: Viewport) => act(() => page.setViewportSize(viewport))
/** The reader's system colour scheme, as the page's `prefers-color-scheme` media query reports it. */
export const ColorScheme = Schema.Literal("light", "dark")
export type ColorScheme = typeof ColorScheme.Type
export const setColorScheme = (page: Page, scheme: ColorScheme) => act(() => page.emulateMedia({ colorScheme: scheme }))

export const visible = (locator: Locator) => act(() => inBrowser(locator).toBeVisible())
export const hidden = (locator: Locator) => act(() => inBrowser(locator).toBeHidden())
export const count = (locator: Locator, expected: number) => act(() => inBrowser(locator).toHaveCount(expected))
export const containsText = (locator: Locator, expected: string | RegExp) =>
  act(() => inBrowser(locator).toContainText(expected))
export const attribute = (locator: Locator, name: string, expected: string | RegExp) =>
  act(() => inBrowser(locator).toHaveAttribute(name, expected))
export const withoutAttribute = (locator: Locator, name: string) =>
  act(() => inBrowser(locator).not.toHaveAttribute(name))
export const urlMatches = (page: Page, pattern: RegExp) => act(() => inBrowser(page).toHaveURL(pattern))

/** Waits for the next response whose URL ends with `suffix` from a request with `method`. */
export const nextResponse = (page: Page, method: string, suffix: string): Effect.Effect<Response, BrowserError> =>
  act(() =>
    page.waitForResponse((response) => response.url().endsWith(suffix) && response.request().method() === method)
  )

export const attached = (locator: Locator) => act(() => inBrowser(locator).toBeAttached())
export const eventually = <A>(read: () => Promise<A>, expected: A) => act(() => inBrowser.poll(read).toBe(expected))

/**
 * Re-reads `read` until `holds` accepts the value, for as long as Playwright's
 * assertions wait. The last value read is the failure's cause.
 */
export const until = <A>(
  read: Effect.Effect<A, BrowserError>,
  holds: (value: A) => boolean,
  description: string
): Effect.Effect<A, BrowserError> =>
  read.pipe(
    Effect.filterOrFail(holds, (value) => new BrowserError({ message: `${description} did not hold`, cause: value })),
    Effect.retry(Schedule.spaced("100 millis").pipe(Schedule.upTo("5 seconds")))
  )

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
 * The page's vertical scroll position read `samples` times in a row, oldest
 * first — a scroll seen over time. A glide shows positions between where it
 * began and where it ends; a landing at once shows only those two.
 */
export const scrollPositions = (page: Page, samples: number): Effect.Effect<ReadonlyArray<number>, BrowserError> =>
  Effect.forEach(Arr.range(1, samples), () => act(() => page.evaluate(scrollY)))

/**
 * Waits until every finite animation on the page (CSS animations and
 * transitions, and Motion's Web Animations) has finished, so geometry is
 * measured at rest rather than mid-flight after a viewport change.
 */
export const animationsSettled = (page: Page) =>
  Effect.asVoid(act(() => page.waitForFunction(finiteAnimationsFinished)))

/** Elements that leak past the viewport; see `elementsPastViewport`. */
export const overflowingElements = (page: Page) => act(() => page.evaluate(elementsPastViewport))
