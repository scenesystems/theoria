import { Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import type {
  DocsApiExportSummary,
  DocsApiModuleIndex,
  DocsApiModuleSummary,
  DocsGuideSummary,
  DocsManifest,
  DocsPackageSummary
} from "@theoria/docs-model"
import { docsPathFor, type DocsRoute } from "../../../contracts/docs.js"

export const DocsDestination = Schema.Struct({
  group: Schema.Literal("Guides", "API"),
  label: Schema.String,
  href: Schema.String,
  aliases: Schema.Array(Schema.String)
})

export type DocsDestination = typeof DocsDestination.Type

export const apiExportForHash = (page: DocsApiModuleIndex, hash: string): Option.Option<DocsApiExportSummary> =>
  Arr.findFirst(page.exports, (apiExport) => `#${apiExport.anchor}` === hash)

export const docsPackageFor = (
  manifest: DocsManifest,
  route: DocsRoute
): Option.Option<DocsPackageSummary> =>
  Match.value(route).pipe(
    Match.tag("DocsIndexRoute", () => Option.none()),
    Match.tag("DocsNotFoundRoute", () => Option.none()),
    Match.orElse(({ packageSlug }) => Arr.findFirst(manifest.packages, (candidate) => candidate.slug === packageSlug))
  )

export const docsGuideFor = (
  docsPackage: DocsPackageSummary,
  route: DocsRoute
): Option.Option<DocsGuideSummary> =>
  Match.value(route).pipe(
    Match.tag("DocsOverviewRoute", () => Option.some(docsPackage.overview)),
    Match.tag("DocsGuideRoute", ({ guideSlug }) =>
      Arr.findFirst(docsPackage.guides, (guide) => guide.slug === guideSlug)),
    Match.orElse(() =>
      Option.none()
    )
  )

export const docsApiModuleFor = (
  docsPackage: DocsPackageSummary,
  route: DocsRoute
): Option.Option<DocsApiModuleSummary> =>
  Match.value(route).pipe(
    Match.tag("DocsApiRoute", ({ moduleSlug }) => {
      const routePath = docsPathFor(route)
      return Arr.findFirst(docsPackage.apiModules, (module) =>
        module.slug === (moduleSlug ?? "") || Arr.contains(module.aliases, routePath))
    }),
    Match.orElse(() =>
      Option.none()
    )
  )

export const docsDestinationsFor = (docsPackage: DocsPackageSummary): ReadonlyArray<DocsDestination> => [
  {
    group: "Guides",
    label: "Overview",
    href: docsPackage.overview.path,
    aliases: []
  },
  ...Arr.map(docsPackage.guides, (guide): DocsDestination => ({
    group: "Guides",
    label: guide.title,
    href: guide.path,
    aliases: []
  })),
  ...Arr.map(docsPackage.apiModules, (module): DocsDestination => ({
    group: "API",
    label: module.slug.length === 0 ? "API reference" : module.name,
    href: module.path,
    aliases: module.aliases
  }))
]

export const destinationIsActive = (destination: DocsDestination, route: DocsRoute): boolean => {
  const path = docsPathFor(route)
  return destination.href === path || Arr.contains(destination.aliases, path)
}
