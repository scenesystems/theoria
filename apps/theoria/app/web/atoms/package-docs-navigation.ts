import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Match, Option } from "effect"

import {
  PackageDocsLandingPageRoute,
  PackageDocsPackagePageRoute,
  type PackageDocsPageRoute,
  type PackageDocsSearchItem
} from "../../contracts/presentation/package-docs.js"
import type { PackageName } from "../../contracts/presentation/package-docs.js"
import { PageLocation } from "../../contracts/presentation/page-location.js"

import { packageDocsActiveGroupAtom } from "./package-docs-group.js"
import { packageDocsPageScrollBodyId } from "./package-docs-page.js"

const routeFromLocation = (location: PageLocation): PackageDocsPageRoute =>
  PackageDocsPackagePageRoute.fromLocation(location).pipe(
    Option.orElse(() => PackageDocsLandingPageRoute.fromLocation(location)),
    Option.getOrElse(() => PackageDocsLandingPageRoute.landing())
  )

const searchItemGroupTitle = (item: PackageDocsSearchItem): string =>
  Match.value(item.kind).pipe(
    Match.when("api", () => "Reference"),
    Match.when("example", () => "Examples"),
    Match.when("guide", () => "README"),
    Match.when("package-entry", () => ""),
    Match.when("release-history", () => "Release History"),
    Match.when("verification", () => "Verification"),
    Match.exhaustive
  )

const scrollToPackageDocsFragment = (fragmentId: string, remainingFrames: number): void => {
  const node = globalThis.document?.getElementById(fragmentId)

  if (node instanceof HTMLElement) {
    node.scrollIntoView({ block: "start" })
    return
  }

  if (remainingFrames <= 0) {
    return
  }

  globalThis.window?.requestAnimationFrame(() => {
    scrollToPackageDocsFragment(fragmentId, remainingFrames - 1)
  })
}

const packageDocsCurrentPath = (): string =>
  `${globalThis.window?.location?.pathname ?? "/packages"}${globalThis.window?.location?.search ?? ""}`

const resetPackageDocsScroll = (): void => {
  const body = globalThis.document?.getElementById(packageDocsPageScrollBodyId)

  if (body instanceof HTMLElement) {
    body.scrollTo({ top: 0 })
    return
  }

  globalThis.window?.scrollTo(0, 0)
}

export const packageDocsLocationAtom: AtomType.Writable<PageLocation> = Atom.make(
  PageLocation.fromPathnameSearch(
    globalThis.window?.location?.pathname ?? "/packages",
    globalThis.window?.location?.search ?? ""
  )
).pipe(Atom.keepAlive)

export const packageDocsRouteFromLocationAtom: AtomType.Atom<PackageDocsPageRoute> = Atom.make(
  (get: AtomType.Context): PackageDocsPageRoute => routeFromLocation(get(packageDocsLocationAtom))
)

export const navigateToPackageAtom = Atom.fnSync<PackageName>()(
  (packageId, ctx) => {
    const route = PackageDocsPackagePageRoute.fromPackageId(packageId)
    const path = route.path()

    globalThis.window?.history?.pushState(null, "", path)
    ctx.registry.set(packageDocsLocationAtom, PageLocation.fromUrl(path))
  }
)

export const navigateToPackageDocsSearchItemAtom = Atom.fnSync<PackageDocsSearchItem>()(
  (item, ctx) => {
    const currentPath = packageDocsCurrentPath()
    const destinationUrl = new URL(item.href, globalThis.window?.location?.origin ?? "http://127.0.0.1")
    const destinationPath = `${destinationUrl.pathname}${destinationUrl.search}`
    const fragmentId = item.fragmentId
    const groupTitle = searchItemGroupTitle(item)
    const routeChanged = destinationPath !== currentPath

    ctx.registry.set(packageDocsActiveGroupAtom, groupTitle)
    globalThis.window?.history?.pushState(null, "", item.href)
    ctx.registry.set(packageDocsLocationAtom, PageLocation.fromUrl(destinationPath))

    if (routeChanged || fragmentId === null) {
      resetPackageDocsScroll()
    }

    if (fragmentId !== null) {
      scrollToPackageDocsFragment(fragmentId, 180)
    }
  }
)
