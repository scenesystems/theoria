import { Atom, Result } from "@effect-atom/atom"
import { Match, Option } from "effect"

import type { DocsManifest } from "@theoria/docs-model"
import { metadataForDocs, metadataForHome, metadataForId, type PageMetadata } from "../../contracts/metadata.js"
import { applyBrowserMetadata } from "../services/browser-metadata.js"
import { isPagePath, pagePathFor, type PageRoute, parsePathname } from "../services/path.js"
import { docsManifestAtom } from "./docs-data.js"
import { docsLocationHashAtom } from "./docs.js"

const routeAtBrowserLocation = (): PageRoute => parsePathname(globalThis.location.pathname)

export const pageRouteAtom = Atom.make(routeAtBrowserLocation())

const docsMetadataForRoute = (
  route: PageRoute,
  manifest: Result.Result<DocsManifest, unknown>
): Option.Option<PageMetadata> =>
  Result.match(manifest, {
    onInitial: Option.none,
    onFailure: Option.none,
    onSuccess: ({ value }) => Option.some(metadataForDocs(value, pagePathFor(route)))
  })

const browserMetadataAtom = Atom.make((ctx) =>
  Match.value(ctx(pageRouteAtom)).pipe(
    Match.tag("HomeRoute", () => Option.some(metadataForHome())),
    Match.tag("DeepRoute", ({ id }) => Option.some(metadataForId(id))),
    Match.orElse((route) => docsMetadataForRoute(route, ctx(docsManifestAtom)))
  )
)

export const browserMetadataMountAtom = Atom.make((ctx) => {
  Option.match(ctx(browserMetadataAtom), {
    onNone: () => undefined,
    onSome: applyBrowserMetadata
  })

  return null
})

const scrollAfterNavigation = (hash: string): void => {
  globalThis.requestAnimationFrame(() => {
    if (hash.length === 0 || hash.startsWith("#api-")) {
      globalThis.scrollTo({ top: 0 })
      document.querySelector<HTMLElement>("[data-route-focus]")?.focus({ preventScroll: true })
      return
    }

    document.getElementById(hash.slice(1))?.scrollIntoView()
  })
}

export const browserNavigationMountAtom = Atom.make((ctx) => {
  const updateLocationState = () => {
    ctx.set(pageRouteAtom, routeAtBrowserLocation())
    ctx.set(docsLocationHashAtom, globalThis.location.hash)
  }

  const onPopState = () => updateLocationState()

  updateLocationState()
  globalThis.addEventListener("popstate", onPopState)
  ctx.addFinalizer(() => {
    globalThis.removeEventListener("popstate", onPopState)
  })

  return null
})

export const navigateAtom = Atom.fnSync<string>()((href, ctx) => {
  const destination = new URL(href, globalThis.location.href)

  if (destination.origin !== globalThis.location.origin || !isPagePath(destination.pathname)) {
    globalThis.location.assign(destination.href)
    return
  }

  const current = `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`
  const next = `${destination.pathname}${destination.search}${destination.hash}`

  if (current !== next) {
    globalThis.history.pushState(null, "", next)
    ctx.set(pageRouteAtom, routeAtBrowserLocation())
    ctx.set(docsLocationHashAtom, globalThis.location.hash)
  }

  scrollAfterNavigation(destination.hash)
})

export const shouldNavigateInBrowser = ({
  button,
  defaultPrevented,
  href,
  metaKey,
  ctrlKey,
  shiftKey,
  altKey,
  target
}: {
  readonly altKey: boolean
  readonly button: number
  readonly ctrlKey: boolean
  readonly defaultPrevented: boolean
  readonly href: string
  readonly metaKey: boolean
  readonly shiftKey: boolean
  readonly target: string | null
}): boolean => {
  if (defaultPrevented || button !== 0 || metaKey || ctrlKey || shiftKey || altKey || target === "_blank") {
    return false
  }

  const destination = new URL(href, globalThis.location.href)
  return destination.origin === globalThis.location.origin && isPagePath(destination.pathname)
}
