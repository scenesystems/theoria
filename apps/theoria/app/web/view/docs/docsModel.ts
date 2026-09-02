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
  label: Schema.String,
  href: Schema.String,
  aliases: Schema.Array(Schema.String)
})

export type DocsDestination = typeof DocsDestination.Type

export const DocsNavigationBranch = Schema.Struct({
  label: Schema.Literal("Guides", "API"),
  root: DocsDestination,
  children: Schema.Array(DocsDestination)
})

export type DocsNavigationBranch = typeof DocsNavigationBranch.Type

export const apiCategoryAnchor = (name: string): string =>
  `category-${name.trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/gu, "-").replace(/(^-|-$)/gu, "")}`

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

const apiDestination = (module: DocsApiModuleSummary): DocsDestination => ({
  label: module.slug.length === 0 ? "API reference" : module.name,
  href: module.path,
  aliases: module.aliases
})

const categoryLabel = (category: string): string => {
  const words = category.replaceAll("-", " ")

  return `${words.slice(0, 1).toLocaleUpperCase("en-US")}${words.slice(1)}`
}

const categoryDestination = (
  module: DocsApiModuleSummary,
  category: string
): DocsDestination => ({
  label: categoryLabel(category),
  href: `${module.path}#${apiCategoryAnchor(category)}`,
  aliases: []
})

export const docsNavigationBranchesFor = (
  docsPackage: DocsPackageSummary
): ReadonlyArray<DocsNavigationBranch> => {
  const rootApiModule = Arr.findFirst(docsPackage.apiModules, (module) => module.slug.length === 0)
  const apiRoot = Option.match(rootApiModule, {
    onNone: (): DocsDestination => ({
      label: "API reference",
      href: `/docs/${docsPackage.slug}/api`,
      aliases: []
    }),
    onSome: apiDestination
  })
  const apiModules = Arr.filter(docsPackage.apiModules, (module) => module.slug.length > 0)
  const apiChildren = apiModules.length > 0
    ? Arr.map(apiModules, apiDestination)
    : Option.match(rootApiModule, {
      onNone: () => [],
      onSome: (module) => Arr.map(module.categories, (category) => categoryDestination(module, category))
    })

  return [{
    label: "Guides",
    root: {
      label: "Overview",
      href: docsPackage.overview.path,
      aliases: []
    },
    children: Arr.map(docsPackage.guides, (guide): DocsDestination => ({
      label: guide.title,
      href: guide.path,
      aliases: []
    }))
  }, {
    label: "API",
    root: apiRoot,
    children: apiChildren
  }]
}

export const destinationIsActive = (destination: DocsDestination, route: DocsRoute): boolean => {
  const path = docsPathFor(route)
  return destination.href === path || Arr.contains(destination.aliases, path)
}
