import {
  type Browser as PlaywrightBrowser,
  type BrowserContext,
  chromium,
  expect as inBrowser,
  type Locator,
  type Page,
  type Response,
  type Route
} from "@playwright/test"
import {
  Chunk,
  Context,
  Data,
  Deferred,
  Duration,
  Effect,
  HashMap,
  Layer,
  Match,
  Option,
  Predicate,
  Queue,
  Ref,
  Runtime,
  Schedule,
  Schema,
  type Scope
} from "effect"
import * as Arr from "effect/Array"

import {
  colorSchemeShown,
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
  /**
   * The console errors and uncaught page errors of every page open, by page,
   * for as long as the page's scope stands — so a helper holding only the
   * page can say what the page told when it reports the page's state.
   */
  readonly failures: Ref.Ref<HashMap.HashMap<Page, Queue.Queue<string>>>
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
    visitors: Ref.make(0),
    failures: Ref.make(HashMap.empty<Page, Queue.Queue<string>>())
  })
)

/**
 * The console errors and uncaught page errors `page` has told since they
 * were last taken; taking them clears the buffer, as `Session.failures`
 * does. None for a page this browser did not open.
 */
export const failuresOf = (page: Page): Effect.Effect<ReadonlyArray<string>, never, Browser> =>
  Effect.flatMap(
    Browser,
    (browser) =>
      Effect.flatMap(Ref.get(browser.failures), (open) =>
        Option.match(HashMap.get(open, page), {
          onNone: () => Effect.succeed(Arr.empty<string>()),
          onSome: (told) => Effect.map(Queue.takeAll(told), Chunk.toReadonlyArray)
        }))
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

/**
 * How many times slower than this machine the page's processor is made, the
 * way DevTools throttles it: every script, layout and paint takes that many
 * times as long, while the clock runs as it does. `1` is this machine.
 */
export const CpuSlowdown = Schema.Number.pipe(Schema.greaterThanOrEqualTo(1))
export type CpuSlowdown = typeof CpuSlowdown.Type

export const openPage = (
  options: {
    readonly viewport?: Viewport
    readonly permissions?: ReadonlyArray<string>
    readonly reducedMotion?: ReducedMotion
    readonly forcedColors?: ForcedColors
    readonly colorScheme?: ColorScheme
    readonly cpuSlowdown?: CpuSlowdown
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
    // Throttling is the DevTools protocol's; it holds for the page's every document until the page closes.
    yield* Option.match(Option.filter(Option.fromNullable(options.cpuSlowdown), (rate) => rate > 1), {
      onNone: () => Effect.void,
      onSome: (rate) =>
        Effect.andThen(
          act(() => context.newCDPSession(page)),
          (devtools) => act(() => devtools.send("Emulation.setCPUThrottlingRate", { rate }))
        )
    })

    // A console error names where it was raised — the resource that failed to load, or the script — so a test
    // can tell the failure it caused from any other.
    const failures = yield* Queue.unbounded<string>()
    page.on("console", (message) => {
      if (message.type() === "error") Queue.unsafeOffer(failures, `${message.text()} (${message.location().url})`)
    })
    page.on("pageerror", (error) => {
      Queue.unsafeOffer(failures, error.message)
    })
    // The page's failures are the browser's to hand back (`failuresOf`) for as long as the page's scope stands.
    yield* Effect.acquireRelease(
      Ref.update(browser.failures, HashMap.set(page, failures)),
      () => Ref.update(browser.failures, HashMap.remove(page))
    )

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
/**
 * Navigates and returns once the document has parsed, without waiting for the `load` event. For a test that holds a
 * subresource the shell preloads (a font, say): those holds keep `load` from firing, and the test wants the page in
 * exactly that state.
 */
export const gotoParsed = (page: Page, path: string) => act(() => page.goto(path, { waitUntil: "domcontentloaded" }))
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
/**
 * Sets the reader's scheme and returns once the page shows it. The app reads
 * the media query through a stream and toggles the theme's class on `<html>`
 * a tick later, so a colour read straight after `emulateMedia` could be the
 * old scheme's; the theme's own transitions then start, and callers that
 * read colours wait for `animationsSettled` as they do after any change.
 */
export const setColorScheme = (page: Page, scheme: ColorScheme) =>
  Effect.andThen(
    act(() => page.emulateMedia({ colorScheme: scheme })),
    eventually(() => page.evaluate(colorSchemeShown), scheme)
  )

/**
 * How long an assertion waits for the page: Playwright's own default, for
 * anything the page does in a moment — an element appearing, an attribute
 * changing. A wait on work the page does over time, a search settling or an
 * exit finishing, names its own budget.
 */
export const assertionWait: Duration.Duration = Duration.seconds(5)

const waiting = (within: Duration.Duration) => ({ timeout: Duration.toMillis(within) })

export const visible = (locator: Locator, within: Duration.Duration = assertionWait) =>
  act(() => inBrowser(locator).toBeVisible(waiting(within)))
export const hidden = (locator: Locator) => act(() => inBrowser(locator).toBeHidden())
export const disabled = (locator: Locator) => act(() => inBrowser(locator).toBeDisabled())
export const count = (locator: Locator, expected: number) => act(() => inBrowser(locator).toHaveCount(expected))
export const containsText = (locator: Locator, expected: string | RegExp) =>
  act(() => inBrowser(locator).toContainText(expected))
export const attribute = (locator: Locator, name: string, expected: string | RegExp) =>
  act(() => inBrowser(locator).toHaveAttribute(name, expected))
export const withoutAttribute = (locator: Locator, name: string) =>
  act(() => inBrowser(locator).not.toHaveAttribute(name))
/**
 * The accessibility tree under `locator`, as Playwright's ARIA snapshot
 * writes it: one YAML line per node, `- role "name"`, children indented.
 * Decoration (`aria-hidden`) has no node.
 */
export const accessibilityTree = (locator: Locator): Effect.Effect<string, BrowserError> =>
  act(() => locator.ariaSnapshot())
export const urlMatches = (page: Page, pattern: RegExp) => act(() => inBrowser(page).toHaveURL(pattern))

/** Waits for the next response whose URL ends with `suffix` from a request with `method`. */
export const nextResponse = (page: Page, method: string, suffix: string): Effect.Effect<Response, BrowserError> =>
  act(() =>
    page.waitForResponse((response) => response.url().endsWith(suffix) && response.request().method() === method)
  )

/** What becomes of a held request once the test lets it go: it reaches the server, or it fails as the network would. */
export const HeldOutcome = Schema.Literal("continue", "fail")
export type HeldOutcome = typeof HeldOutcome.Type

/** A request held at the browser's edge, and the two ways to let it go. */
export class HeldRequest extends Data.Class<{
  readonly release: Effect.Effect<void>
  readonly fail: Effect.Effect<void>
}> {}

/**
 * Holds the next request with `method` whose URL ends with `suffix` until the
 * test lets it go — to the server with `release`, or as a network failure
 * with `fail` — so the page's pending state can be observed for as long as an
 * assertion needs, and its failure state made to happen. One request is held;
 * every other one, and every one after, passes as it would have.
 */
export const holdResponse = (
  page: Page,
  method: string,
  suffix: string
): Effect.Effect<HeldRequest, BrowserError> =>
  Effect.flatMap(
    Ref.make(false),
    (held) => holdRequests(page, method, suffix, Ref.getAndSet(held, true).pipe(Effect.map((taken) => !taken)))
  )

/**
 * Holds every request with `method` whose URL ends with `suffix`, however many
 * there are, until the test lets them all go together — for a resource the
 * page fetches in several files, such as its typefaces.
 */
export const holdResponses = (
  page: Page,
  method: string,
  suffix: string
): Effect.Effect<HeldRequest, BrowserError> => holdRequests(page, method, suffix, Effect.succeed(true))

const holdRequests = (
  page: Page,
  method: string,
  suffix: string,
  claim: Effect.Effect<boolean>
): Effect.Effect<HeldRequest, BrowserError> =>
  Effect.gen(function*() {
    const runtime = yield* Effect.runtime<never>()
    const outcome = yield* Deferred.make<HeldOutcome>()
    const settle = (route: Route) =>
      Deferred.await(outcome).pipe(
        Effect.flatMap((decision) =>
          act(() =>
            Match.value(decision).pipe(
              Match.when("continue", () => route.continue()),
              Match.when("fail", () => route.abort("failed")),
              Match.exhaustive
            )
          )
        )
      )
    yield* act(() =>
      page.route(
        (url) => url.pathname.endsWith(suffix),
        (route) =>
          Runtime.runPromise(runtime)(
            route.request().method() === method
              ? Effect.if(claim, { onTrue: () => settle(route), onFalse: () => act(() => route.fallback()) })
              : act(() => route.fallback())
          )
      )
    )
    return new HeldRequest({
      release: Effect.asVoid(Deferred.succeed(outcome, "continue")),
      fail: Effect.asVoid(Deferred.succeed(outcome, "fail"))
    })
  })

export const attached = (locator: Locator) => act(() => inBrowser(locator).toBeAttached())
export const eventually = <A>(read: () => Promise<A>, expected: A, within: Duration.Duration = assertionWait) =>
  act(() => inBrowser.poll(read, waiting(within)).toBe(expected))

/**
 * Re-reads `read` until `holds` accepts the value, for as long as an
 * assertion waits unless told otherwise. The last value read is the failure's cause.
 */
export const until = <A>(
  read: Effect.Effect<A, BrowserError>,
  holds: (value: A) => boolean,
  description: string,
  within: Duration.Duration = assertionWait
): Effect.Effect<A, BrowserError> =>
  read.pipe(
    Effect.filterOrFail(holds, (value) => new BrowserError({ message: `${description} did not hold`, cause: value })),
    Effect.retry(Schedule.spaced("100 millis").pipe(Schedule.upTo(within)))
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
