import { Match, Option, Order, Schema } from "effect"
import * as Arr from "effect/Array"

import type {
  DocsApiModuleSummary,
  DocsGuideSummary,
  DocsManifest,
  DocsPackageSummary,
  DocsSearchEntry
} from "@theoria/docs-model"
import { docsPathFor, type DocsRoute } from "../../../contracts/docs.js"

export const DocsDestination = Schema.Struct({
  group: Schema.Literal("Guides", "API"),
  label: Schema.String,
  href: Schema.String,
  aliases: Schema.Array(Schema.String)
})

export type DocsDestination = typeof DocsDestination.Type

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

const normalized = (value: string): string => value.trim().toLocaleLowerCase("en-US")

const matchScore = (entry: DocsSearchEntry, query: string, packageSlug: string | null): number => {
  const term = normalized(query)
  const name = normalized(entry.name)
  const qualifiedName = normalized(entry.qualifiedName)
  const summary = normalized(entry.summary)
  const packageBoost = entry.packageSlug === packageSlug ? 8 : 0

  if (term.length === 0) {
    return Match.value(entry.kind).pipe(
      Match.when("package", () => 100),
      Match.when("guide", () => 70),
      Match.when("module", () => 50),
      Match.when("symbol", () => -1),
      Match.exhaustive
    ) + packageBoost
  }

  if (name === term) return 120 + packageBoost
  if (name.startsWith(term)) return 100 + packageBoost
  if (qualifiedName.includes(term)) return 80 + packageBoost
  if (summary.includes(term)) return 50 + packageBoost

  const tokens = term.split(/\s+/u)
  const haystack = `${qualifiedName} ${summary}`
  return Arr.every(tokens, (token) => haystack.includes(token)) ? 35 + packageBoost : -1
}

const scoreOrder = Order.reverse(Order.mapInput(
  Order.number,
  (entry: { readonly score: number; readonly result: DocsSearchEntry }) => entry.score
))

export const docsSearchResults = (
  entries: ReadonlyArray<DocsSearchEntry>,
  query: string,
  packageSlug: string | null
): ReadonlyArray<DocsSearchEntry> =>
  Arr.take(
    Arr.map(
      Arr.sort(
        Arr.filterMap(entries, (result) => {
          const score = matchScore(result, query, packageSlug)
          return score < 0 ? Option.none() : Option.some({ result, score })
        }),
        scoreOrder
      ),
      ({ result }) => result
    ),
    20
  )
