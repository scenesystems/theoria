import { type PackageName } from "@theoria/source-proof/contracts"
import { Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { type EntryId, EntryId as EntryIdSchema } from "../entry/id.js"
import {
  entryIdForPath,
  entryPathForId,
  visibleEntryIdsForReleaseStage,
  visiblePackageDocsPackageIdsForReleaseStage
} from "../entry/routing.js"
import type { ReleaseStage } from "../release-stage.js"

import {
  PackageDocsLandingPageRoute,
  PackageDocsPackagePageRoute,
  type PackageDocsPageRoute,
  PackageDocsPageRouteSchema
} from "./package-docs.js"
import {
  decodePageRouteKey,
  deepPageRouteKey,
  homePageRouteKey,
  packageDocsLandingPageRouteKey,
  packageDocsPackagePageRouteKey,
  type PageRouteKey,
  type SerializedPageRouteKey
} from "./page-route-key.js"

export class HomePageRoute extends Schema.TaggedClass<HomePageRoute>()("HomeRoute", {}) {}

export class DeepPageRoute extends Schema.TaggedClass<DeepPageRoute>()("DeepRoute", {
  entryId: EntryIdSchema
}) {}

export class PackageDocsRoute extends Schema.TaggedClass<PackageDocsRoute>()("PackageDocsRoute", {
  route: PackageDocsPageRouteSchema
}) {}

export const PageRoute = Schema.Union(HomePageRoute, DeepPageRoute, PackageDocsRoute)

export type PageRoute = typeof PageRoute.Type

const homeRoute = HomePageRoute.make({})

export const homePageRoute: PageRoute = homeRoute

export const deepPageRoute = (entryId: EntryId): PageRoute => DeepPageRoute.make({ entryId })

export const packageDocsPageRoute = (packageId: PackageName | null): PageRoute =>
  PackageDocsRoute.make({
    route: packageId === null
      ? PackageDocsLandingPageRoute.make({})
      : PackageDocsPackagePageRoute.make({ packageId })
  })

const deepDiveRoute = (
  pathname: string,
  resolveEntryId: (pathname: string) => Option.Option<EntryId>
): Option.Option<PageRoute> => resolveEntryId(pathname).pipe(Option.map(deepPageRoute))

const packageDocsRoute = (pathname: string, search: string): Option.Option<PageRoute> =>
  PackageDocsPackagePageRoute.fromPathname(pathname, search).pipe(
    Option.map((route): PageRoute => PackageDocsRoute.make({ route })),
    Option.orElse(() =>
      PackageDocsLandingPageRoute.fromPathname(pathname, search).pipe(
        Option.map((route): PageRoute => PackageDocsRoute.make({ route }))
      )
    )
  )

const routeForPathname = (
  pathname: string,
  search: string,
  resolveEntryId: (pathname: string) => Option.Option<EntryId>
): Option.Option<PageRoute> =>
  Match.value(pathname).pipe(
    Match.when("/", () => Option.some(homeRoute)),
    Match.when("/index.html", () => Option.some(homeRoute)),
    Match.orElse((value) => Option.orElse(deepDiveRoute(value, resolveEntryId), () => packageDocsRoute(value, search)))
  )

export const pageRouteForPathname = (pathname: string, search = ""): Option.Option<PageRoute> =>
  routeForPathname(pathname, search, entryIdForPath)

const packageDocsRouteVisibleInReleaseStage = (packageId: PackageName, stage: ReleaseStage): boolean =>
  visiblePackageDocsPackageIdsForReleaseStage(stage).includes(packageId)

const pageRouteVisibleInReleaseStage = (route: PageRoute, stage: ReleaseStage): boolean =>
  Match.value(route).pipe(
    Match.tag("HomeRoute", () => true),
    Match.tag("DeepRoute", ({ entryId }) => visibleEntryIdsForReleaseStage(stage).includes(entryId)),
    Match.tag("PackageDocsRoute", ({ route: packageDocsRoute }) =>
      Option.match(Option.fromNullable(packageDocsRoute.selectedPackageId()), {
        onNone: () =>
          false,
        onSome: (packageId) => packageDocsRouteVisibleInReleaseStage(packageId, stage)
      })),
    Match.exhaustive
  )

export const visiblePageRouteForPathname = (
  pathname: string,
  search: string,
  stage: ReleaseStage
): Option.Option<PageRoute> =>
  pageRouteForPathname(pathname, search).pipe(Option.filter((route) => pageRouteVisibleInReleaseStage(route, stage)))

export const isPackageDocsLandingPath = (pathname: string, search = ""): boolean =>
  packageDocsRoute(pathname, search).pipe(
    Option.match({
      onNone: () => false,
      onSome: (route) => route._tag === "PackageDocsRoute" && route.route.selectedPackageId() === null
    })
  )

export const packageDocsLandingRedirectPathForReleaseStage = (stage: ReleaseStage): string | null => {
  const packageId = visiblePackageDocsPackageIdsForReleaseStage(stage)[0] ?? null
  return packageId === null ? null : PackageDocsPackagePageRoute.make({ packageId }).path()
}

const packageDocsRouteKey = (route: PackageDocsPageRoute): PageRouteKey => {
  const packageId = route.selectedPackageId()

  return packageId === null
    ? packageDocsLandingPageRouteKey
    : packageDocsPackagePageRouteKey(packageId)
}

export const pageRouteKey = (route: PageRoute): PageRouteKey =>
  Match.value(route).pipe(
    Match.withReturnType<PageRouteKey>(),
    Match.tag("HomeRoute", () => homePageRouteKey),
    Match.tag("DeepRoute", ({ entryId }) => deepPageRouteKey(entryId)),
    Match.tag("PackageDocsRoute", ({ route: packageDocsRoute }) => packageDocsRouteKey(packageDocsRoute)),
    Match.exhaustive
  )

export const pageRouteForKey = (key: PageRouteKey): PageRoute =>
  Match.value(key).pipe(
    Match.tag("HomePageRouteKey", () => homePageRoute),
    Match.tag("PackageDocsLandingPageRouteKey", () => packageDocsPageRoute(null)),
    Match.tag("DeepPageRouteKey", ({ entryId }) => deepPageRoute(entryId)),
    Match.tag("PackageDocsPackagePageRouteKey", ({ packageId }) => packageDocsPageRoute(packageId)),
    Match.exhaustive
  )

export const pageRouteForSerializedKey = (key: SerializedPageRouteKey): PageRoute =>
  decodePageRouteKey(key).pipe(
    Option.map(pageRouteForKey),
    Option.getOrElse(() => homePageRoute)
  )

export const visibleEntryIdsForPageRoute = (
  route: PageRoute,
  stage: ReleaseStage
): ReadonlyArray<EntryId> =>
  Match.value(route).pipe(
    Match.tag("HomeRoute", () => visibleEntryIdsForReleaseStage(stage)),
    Match.tag("DeepRoute", ({ entryId }) => [entryId]),
    Match.tag("PackageDocsRoute", () => []),
    Match.exhaustive
  )

export const pagePathForRoute = (route: PageRoute): string =>
  Match.value(route).pipe(
    Match.tag("HomeRoute", () => "/"),
    Match.tag("PackageDocsRoute", ({ route: packageDocsRoute }) => packageDocsRoute.path()),
    Match.tag("DeepRoute", ({ entryId }) => entryPathForId(entryId)),
    Match.exhaustive
  )

export const visiblePageRoutesForReleaseStage = (stage: ReleaseStage): ReadonlyArray<PageRoute> => [
  homePageRoute,
  ...Arr.map(visiblePackageDocsPackageIdsForReleaseStage(stage), packageDocsPageRoute),
  ...Arr.map(visibleEntryIdsForReleaseStage(stage), deepPageRoute)
]

export const visiblePagePathsForReleaseStage = (stage: ReleaseStage): ReadonlyArray<string> =>
  Arr.map(visiblePageRoutesForReleaseStage(stage), pagePathForRoute)

export const parsePathname = (pathname: string, search = ""): PageRoute =>
  Option.getOrElse(pageRouteForPathname(pathname, search), () => homeRoute)

export const isHtmlPagePath = (pathname: string, stage: ReleaseStage, search = ""): boolean =>
  Option.isSome(visiblePageRouteForPathname(pathname, search, stage))

export { decodePageRouteKey, PageRouteKey, serializePageRouteKey } from "./page-route-key.js"
export type { SerializedPageRouteKey } from "./page-route-key.js"
