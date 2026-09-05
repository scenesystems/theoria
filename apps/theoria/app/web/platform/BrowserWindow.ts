import { Url } from "@effect/platform"
import { Context, Effect, type Either, Layer, Stream } from "effect"
import type { IllegalArgumentException } from "effect/Cause"

/**
 * The window this page runs in, as a service. Everything the app needs from
 * the window — its location, history, scroll position, media queries, events
 * and the DOM constructors it owns — is reached through this tag, so atoms,
 * components and tests never touch the global themselves and tests can
 * provide any window they like.
 *
 * @since 0.2.0
 */
export class BrowserWindow extends Context.Tag("theoria/BrowserWindow")<BrowserWindow, typeof window>() {}

/** The ambient window. This is the one place the app reads the global. */
export const layer: Layer.Layer<BrowserWindow> = Layer.sync(BrowserWindow, () => window)

/** The document's current URL. A window's own location is always a valid URL, so a parse failure is a defect. */
export const currentUrl: Effect.Effect<URL, never, BrowserWindow> = Effect.flatMap(
  BrowserWindow,
  (browserWindow) => Url.fromString(browserWindow.location.href)
).pipe(Effect.orDie)

/** Resolves `href` against the document's current URL; a malformed `href` is the caller's error to handle. */
export const resolveUrl = (href: string): Effect.Effect<URL, IllegalArgumentException, BrowserWindow> =>
  Effect.flatMap(BrowserWindow, (browserWindow) => Url.fromString(href, browserWindow.location.href))

/** Resolves `href` against `base` without a service, for callers that already hold the current URL. */
export const resolveAgainst = (href: string, base: URL): Either.Either<URL, IllegalArgumentException> =>
  Url.fromString(href, base.href)

/** Adds a same-document history entry without loading anything. */
export const pushState = (url: URL): Effect.Effect<void, never, BrowserWindow> =>
  Effect.flatMap(BrowserWindow, (browserWindow) =>
    Effect.sync(() => {
      browserWindow.history.pushState(null, "", url.href)
    }))

/** Performs a full navigation to `url`. */
export const assign = (url: URL): Effect.Effect<void, never, BrowserWindow> =>
  Effect.flatMap(BrowserWindow, (browserWindow) =>
    Effect.sync(() => {
      browserWindow.location.assign(url.href)
    }))

export const scrollToTop: Effect.Effect<void, never, BrowserWindow> = Effect.flatMap(
  BrowserWindow,
  (browserWindow) =>
    Effect.sync(() => {
      browserWindow.scrollTo({ top: 0 })
    })
)

/** True when the viewport has scrolled to (within two pixels of) the bottom of the document. */
export const isScrolledToBottom: Effect.Effect<boolean, never, BrowserWindow> = Effect.map(
  BrowserWindow,
  (browserWindow) =>
    browserWindow.scrollY > 0
    && browserWindow.innerHeight + browserWindow.scrollY >= browserWindow.document.documentElement.scrollHeight - 2
)

/** Window events of one type as a stream; the listener is removed when the stream ends. */
export const events = <K extends keyof WindowEventMap>(
  type: K,
  options?: boolean | AddEventListenerOptions
): Stream.Stream<WindowEventMap[K], never, BrowserWindow> =>
  Stream.unwrap(
    Effect.map(BrowserWindow, (browserWindow) =>
      Stream.fromEventListener<WindowEventMap[K]>(browserWindow, type, options))
  )

/** Whether `query` matches now, followed by every change while the stream is running. */
export const mediaQuery = (query: string): Stream.Stream<boolean, never, BrowserWindow> =>
  Stream.unwrap(
    Effect.map(BrowserWindow, (browserWindow) => {
      const list = browserWindow.matchMedia(query)

      return Stream.concat(
        Stream.succeed(list.matches),
        Stream.map(Stream.fromEventListener<MediaQueryListEvent>(list, "change"), (event) => event.matches)
      )
    })
  )
