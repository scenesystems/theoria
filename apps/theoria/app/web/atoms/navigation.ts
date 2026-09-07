import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Match, Option, Schema, Stream } from "effect"

import type { DocsManifest } from "@theoria/docs-model"
import { metadataForDocs, metadataForHome, type PageMetadata } from "../../contracts/metadata.js"
import { nextFrame } from "../platform/AnimationFrame.js"
import * as BrowserDocument from "../platform/BrowserDocument.js"
import * as BrowserWindow from "../platform/BrowserWindow.js"
import { applyBrowserMetadata } from "../services/browser-metadata.js"
import { isPagePath, pagePathFor, type PageRoute, parsePathname } from "../services/path.js"
import { docsManifestAtom } from "./docs-data.js"
import { docsLocationHashAtom } from "./docs.js"
import { ScrollManner } from "./motion.js"
import { appRuntime } from "./runtime.js"

const routeForUrl = (url: URL): PageRoute => parsePathname(url.pathname)

/**
 * The route on screen. `browserNavigationMountAtom` sets it from the window
 * before the first route renders and keeps it current through history
 * traversal; `navigateAtom` sets it when the app pushes a new entry.
 */
export const pageRouteAtom: AtomType.Writable<PageRoute> = Atom.make(parsePathname("/"))

const docsMetadataForRoute = (
  route: PageRoute,
  manifest: Result.Result<DocsManifest, unknown>
): Option.Option<PageMetadata> =>
  Result.match(manifest, {
    onInitial: Option.none,
    onFailure: Option.none,
    onSuccess: ({ value }) => Option.some(metadataForDocs(value, pagePathFor(route)))
  })

const browserMetadataAtom = Atom.make((get) =>
  Match.value(get(pageRouteAtom)).pipe(
    Match.tag("HomeRoute", () => Option.some(metadataForHome())),
    Match.orElse((route) => docsMetadataForRoute(route, get(docsManifestAtom)))
  )
)

/** Writes the current route's metadata into the shell's `<head>` whenever the route or manifest changes. */
export const browserMetadataMountAtom: AtomType.Atom<Result.Result<void>> = appRuntime.atom((get) =>
  Option.match(get(browserMetadataAtom), {
    onNone: () => Effect.void,
    onSome: applyBrowserMetadata
  })
)

/** The document URL now and after every history traversal. */
const locationUrls: Stream.Stream<URL, never, BrowserWindow.BrowserWindow> = Stream.concat(
  Stream.fromEffect(BrowserWindow.currentUrl),
  Stream.mapEffect(BrowserWindow.events("popstate"), () => BrowserWindow.currentUrl)
)

/** Keeps `pageRouteAtom` and the docs fragment in step with the window while the app shell is mounted. */
export const browserNavigationMountAtom: AtomType.Atom<Result.Result<void>> = appRuntime.atom((get) =>
  Stream.runForEach(locationUrls, (url) =>
    Effect.sync(() => {
      get.set(pageRouteAtom, routeForUrl(url))
      get.set(docsLocationHashAtom, url.hash)
    }))
)

/**
 * After the new route has rendered: fragments scroll to their element, while
 * plain routes and API anchors (which select a page, not a position) start at
 * the top with focus on the route's landmark.
 */
const settleAfterNavigation = (
  hash: string
): Effect.Effect<void, never, BrowserWindow.BrowserWindow | BrowserDocument.BrowserDocument> =>
  Effect.gen(function*() {
    yield* nextFrame

    if (hash.length === 0 || hash.startsWith("#api-")) {
      yield* BrowserWindow.scrollToTop
      const landmark = yield* BrowserDocument.querySelector("[data-route-focus]")
      Option.match(landmark, { onNone: () => {}, onSome: (element) => element.focus({ preventScroll: true }) })
      return
    }

    const anchor = yield* BrowserDocument.elementById(hash.slice(1))
    Option.match(anchor, { onNone: () => {}, onSome: (element) => element.scrollIntoView() })
  })

/**
 * After the new route has rendered: the element named by `selector` is
 * brought to the middle of the viewport — gliding or at once, as the visitor's
 * motion preference says — and given focus, so the route lands on a thing
 * rather than a position.
 */
const settleOnElement = (
  selector: string,
  behavior: ScrollManner
): Effect.Effect<void, never, BrowserDocument.BrowserDocument> =>
  Effect.gen(function*() {
    yield* nextFrame
    const target = yield* BrowserDocument.querySelector(selector)
    Option.match(target, {
      onNone: () => {},
      onSome: (element) => {
        element.scrollIntoView({ behavior, block: "center" })
        element.focus({ preventScroll: true })
      }
    })
  })

const relativeReference = (url: URL): string => `${url.pathname}${url.search}${url.hash}`

const isAppDestination = (destination: URL, current: URL): boolean =>
  destination.origin === current.origin && isPagePath(destination.pathname)

/**
 * Makes `destination` the document's entry and the route on screen, unless it
 * already is. The caller has established that `destination` is an app route.
 */
const enterAppRoute = (
  destination: URL,
  current: URL,
  ctx: AtomType.FnContext
): Effect.Effect<void, never, BrowserWindow.BrowserWindow> =>
  relativeReference(destination) === relativeReference(current)
    ? Effect.void
    : Effect.andThen(BrowserWindow.pushState(destination), () => {
      ctx.set(pageRouteAtom, routeForUrl(destination))
      ctx.set(docsLocationHashAtom, destination.hash)
    })

/**
 * Navigates to `href`. App routes on this origin become a history entry and a
 * route change without a page load; anything else is a full navigation. An
 * `href` that cannot resolve against the document is a programming error.
 */
export const navigateAtom = appRuntime.fn<string>()((href, ctx) =>
  Effect.gen(function*() {
    const current = yield* BrowserWindow.currentUrl
    const destination = yield* Effect.orDie(BrowserWindow.resolveAgainst(href, current))

    if (!isAppDestination(destination, current)) {
      yield* BrowserWindow.assign(destination)
      return
    }

    yield* enterAppRoute(destination, current, ctx)
    yield* settleAfterNavigation(destination.hash)
  })
)

/** A navigation within the app that lands on a particular element rather than on its hash's position. */
export const ElementNavigation = Schema.Struct({
  href: Schema.String,
  selector: Schema.String,
  behavior: ScrollManner
})
export type ElementNavigation = typeof ElementNavigation.Type

/**
 * Navigates to `href` — an app route on this origin, or a programming error —
 * and settles on the element `selector` names once the route has rendered.
 */
export const navigateToElementAtom = appRuntime.fn<ElementNavigation>()((navigation, ctx) =>
  Effect.gen(function*() {
    const current = yield* BrowserWindow.currentUrl
    const destination = yield* Effect.orDie(BrowserWindow.resolveAgainst(navigation.href, current))
    yield* enterAppRoute(destination, current, ctx)
    yield* settleOnElement(navigation.selector, navigation.behavior)
  })
)

/**
 * Whether a click on an internal link should be handled by `navigateAtom`.
 * Modified clicks, non-primary buttons, handled events and new-tab targets
 * keep the browser's own behaviour.
 */
export const shouldNavigateInBrowser = ({
  altKey,
  button,
  ctrlKey,
  defaultPrevented,
  metaKey,
  shiftKey,
  target
}: {
  readonly altKey: boolean
  readonly button: number
  readonly ctrlKey: boolean
  readonly defaultPrevented: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
  readonly target: Option.Option<string>
}): boolean =>
  !(defaultPrevented || button !== 0 || metaKey || ctrlKey || shiftKey || altKey || Option.contains(target, "_blank"))
