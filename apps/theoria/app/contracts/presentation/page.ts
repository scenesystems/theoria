import { Match, Schema } from "effect"

import { EntryPresentation } from "../entry/routing.js"

import { PageMetadata } from "./metadata.js"
import { PackageDocsPageRouteSchema } from "./package-docs.js"
import type { PageLocation } from "./page-location.js"
import { EntryRoute, HomePageRoute, PackageDocsRoute, PageRoute } from "./path.js"

export class HomePagePresentation extends Schema.TaggedClass<HomePagePresentation>()("HomePagePresentation", {
  route: HomePageRoute,
  metadata: PageMetadata
}) {}

export class EntryPagePresentation extends Schema.TaggedClass<EntryPagePresentation>()("EntryPagePresentation", {
  entry: EntryPresentation,
  route: EntryRoute,
  metadata: PageMetadata
}) {}

export class PackageDocsPagePresentation extends Schema.TaggedClass<PackageDocsPagePresentation>()(
  "PackageDocsPagePresentation",
  {
    packageDocsRoute: PackageDocsPageRouteSchema,
    route: PackageDocsRoute,
    metadata: PageMetadata
  }
) {}

export class PagePresentation {
  static metadata(route: PageRoute.Value): PageMetadata {
    return Match.value(route).pipe(
      Match.tag("HomeRoute", () => PageMetadata.home()),
      Match.tag("EntryRoute", ({ entryId }) => PageMetadata.fromEntryId(entryId)),
      Match.tag(
        "PackageDocsRoute",
        ({ route: packageDocsRoute }) => PageMetadata.fromPackageDocsRoute(packageDocsRoute)
      ),
      Match.exhaustive
    )
  }

  static project(route: PageRoute.Value): PagePresentation.Value {
    return Match.value(route).pipe(
      Match.withReturnType<PagePresentation.Value>(),
      Match.tag(
        "HomeRoute",
        (value) => HomePagePresentation.make({ route: value, metadata: PagePresentation.metadata(value) })
      ),
      Match.tag(
        "EntryRoute",
        (value) =>
          EntryPagePresentation.make({
            entry: EntryPresentation.fromEntryId(value.entryId),
            route: value,
            metadata: PagePresentation.metadata(value)
          })
      ),
      Match.tag(
        "PackageDocsRoute",
        (value) =>
          PackageDocsPagePresentation.make({
            packageDocsRoute: value.route,
            route: value,
            metadata: PagePresentation.metadata(value)
          })
      ),
      Match.exhaustive
    )
  }

  static fromLocation(location: PageLocation): PagePresentation.Value {
    return PagePresentation.project(PageRoute.fromLocation(location))
  }
}

export namespace PagePresentation {
  export const schema = Schema.Union(
    HomePagePresentation,
    EntryPagePresentation,
    PackageDocsPagePresentation
  )

  export type Value = typeof schema.Type
}
