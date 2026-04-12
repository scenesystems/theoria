import { type PackageName } from "@theoria/source-proof/contracts"
import { Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { type EntryId, EntryId as EntryIdSchema } from "../entry/id.js"
import { EntryRegistry } from "../entry/registry.js"
import type { ReleaseStage } from "../release-stage.js"

import {
  PackageDocsLandingPageRoute,
  PackageDocsPackagePageRoute,
  type PackageDocsPageRoute,
  PackageDocsPageRouteSchema
} from "./package-docs.js"
import type { PageLocation } from "./page-location.js"
import type { PageRouteKey } from "./page-route-key.js"
import {
  EntryRouteKey,
  HomePageRouteKey,
  PackageDocsLandingPageRouteKey,
  PackageDocsPackagePageRouteKey
} from "./page-route-key.js"

export class HomePageRoute extends Schema.TaggedClass<HomePageRoute>()("HomeRoute", {}) {
  static home(): HomePageRoute {
    return homeRoute
  }

  static fromLocation(location: PageLocation): Option.Option<HomePageRoute> {
    return location.pathname === "/" || location.pathname === "/index.html"
      ? Option.some(HomePageRoute.home())
      : Option.none()
  }

  key(): HomePageRouteKey {
    return HomePageRouteKey.home()
  }

  path(): string {
    return "/"
  }

  visibleEntryIds(stage: ReleaseStage): ReadonlyArray<EntryId> {
    return entryRegistry.visibleEntryIdsForReleaseStage(stage)
  }

  visibleInReleaseStage(_: ReleaseStage): boolean {
    return true
  }
}

export class EntryRoute extends Schema.TaggedClass<EntryRoute>()("EntryRoute", {
  entryId: EntryIdSchema
}) {
  static fromEntryId(entryId: EntryId): EntryRoute {
    return EntryRoute.make({ entryId })
  }

  static fromLocation(
    location: PageLocation,
    registry: EntryRegistry = entryRegistry
  ): Option.Option<EntryRoute> {
    return registry.entryIdForPath(location.pathname).pipe(Option.map(EntryRoute.fromEntryId))
  }

  key(): EntryRouteKey {
    return EntryRouteKey.fromEntryId(this.entryId)
  }

  path(): string {
    return entryRegistry.descriptorForId(this.entryId).path
  }

  visibleEntryIds(_: ReleaseStage): ReadonlyArray<EntryId> {
    return [this.entryId]
  }

  visibleInReleaseStage(stage: ReleaseStage): boolean {
    return entryRegistry.descriptorForId(this.entryId).visibleInReleaseStage(stage)
  }
}

export class PackageDocsRoute extends Schema.TaggedClass<PackageDocsRoute>()("PackageDocsRoute", {
  route: PackageDocsPageRouteSchema
}) {
  static fromPageRoute(route: PackageDocsPageRoute): PackageDocsRoute {
    return PackageDocsRoute.make({ route })
  }

  static fromLocation(location: PageLocation): Option.Option<PackageDocsRoute> {
    return PackageDocsPackagePageRoute.fromLocation(location).pipe(
      Option.map(PackageDocsRoute.fromPageRoute),
      Option.orElse(() =>
        PackageDocsLandingPageRoute.fromLocation(location).pipe(
          Option.map(PackageDocsRoute.fromPageRoute)
        )
      )
    )
  }

  static fromSelectedPackageId(packageId: PackageName | null): PackageDocsRoute {
    return PackageDocsRoute.fromPageRoute(
      packageId === null
        ? PackageDocsLandingPageRoute.landing()
        : PackageDocsPackagePageRoute.fromPackageId(packageId)
    )
  }

  static isLandingLocation(location: PageLocation): boolean {
    return PackageDocsRoute.fromLocation(location).pipe(
      Option.match({
        onNone: () => false,
        onSome: (route) => route.route.selectedPackageId() === null
      })
    )
  }

  static redirectPathForReleaseStage(stage: ReleaseStage): string | null {
    const packageId = entryRegistry.visiblePackageDocsPackageIdsForReleaseStage(stage)[0] ?? null
    return packageId === null ? null : PackageDocsRoute.fromSelectedPackageId(packageId).path()
  }

  key(): PageRouteKey.Value {
    const packageId = this.route.selectedPackageId()

    return packageId === null
      ? PackageDocsLandingPageRouteKey.landing()
      : PackageDocsPackagePageRouteKey.fromPackageId(packageId)
  }

  path(): string {
    return this.route.path()
  }

  visibleEntryIds(_: ReleaseStage): ReadonlyArray<EntryId> {
    return []
  }

  visibleInReleaseStage(stage: ReleaseStage): boolean {
    const packageId = this.route.selectedPackageId()

    return packageId !== null && entryRegistry.visiblePackageDocsPackageIdsForReleaseStage(stage).includes(packageId)
  }
}

export class PageRoute {
  static optionFromLocation(location: PageLocation): Option.Option<PageRoute.Value> {
    return HomePageRoute.fromLocation(location).pipe(
      Option.orElse(() => EntryRoute.fromLocation(location)),
      Option.orElse(() => PackageDocsRoute.fromLocation(location))
    )
  }

  static fromLocation(location: PageLocation): PageRoute.Value {
    return Option.getOrElse(PageRoute.optionFromLocation(location), () => HomePageRoute.home())
  }

  static visibleOptionFromLocation(location: PageLocation, stage: ReleaseStage): Option.Option<PageRoute.Value> {
    return PageRoute.optionFromLocation(location).pipe(
      Option.filter((route) => route.visibleInReleaseStage(stage))
    )
  }

  static visibleForReleaseStage(stage: ReleaseStage): ReadonlyArray<PageRoute.Value> {
    return [
      HomePageRoute.home(),
      ...Arr.map(
        entryRegistry.visiblePackageDocsPackageIdsForReleaseStage(stage),
        PackageDocsRoute.fromSelectedPackageId
      ),
      ...Arr.map(entryRegistry.visibleEntryIdsForReleaseStage(stage), EntryRoute.fromEntryId)
    ]
  }

  static visiblePathsForReleaseStage(stage: ReleaseStage): ReadonlyArray<string> {
    return Arr.map(PageRoute.visibleForReleaseStage(stage), (route) => route.path())
  }

  static isHtmlLocation(location: PageLocation, stage: ReleaseStage): boolean {
    return Option.isSome(PageRoute.visibleOptionFromLocation(location, stage))
  }
}

export namespace PageRoute {
  export const schema = Schema.Union(HomePageRoute, EntryRoute, PackageDocsRoute)

  export type Value = typeof schema.Type
}

const homeRoute = HomePageRoute.make({})
const entryRegistry = EntryRegistry.current()
export { PageRouteKey } from "./page-route-key.js"
export type { SerializedPageRouteKey } from "./page-route-key.js"
