import { Match, Schema } from "effect"
import * as Arr from "effect/Array"

import type { Card } from "../../../contracts/card.js"
import {
  docsApiRoute,
  docsGettingStartedRoute,
  docsOverviewRoute,
  docsPathFor,
  type DocsRoute,
  type DocsSection
} from "../../../contracts/docs.js"

export const DocsDestination = Schema.Struct({
  section: Schema.Literal("overview", "getting-started", "api"),
  label: Schema.String,
  description: Schema.String,
  href: Schema.String,
  keywords: Schema.Array(Schema.String)
})

export type DocsDestination = typeof DocsDestination.Type

export const DocsPageCopy = Schema.Struct({
  eyebrow: Schema.String,
  title: Schema.String,
  description: Schema.String
})

export type DocsPageCopy = typeof DocsPageCopy.Type

export const docsDestinationsFor = (route: DocsRoute): ReadonlyArray<DocsDestination> => [
  {
    section: "overview",
    label: "Overview",
    description: "Package purpose, guarantees, and first steps.",
    href: docsPathFor(docsOverviewRoute(route.packageSlug)),
    keywords: ["overview", "package", "introduction"]
  },
  {
    section: "getting-started",
    label: "Getting started",
    description: "Install the package and run the first Effect program.",
    href: docsPathFor(docsGettingStartedRoute(route.packageSlug)),
    keywords: ["install", "setup", "quick start", "guide"]
  },
  {
    section: "api",
    label: "API reference",
    description: "Browse the canonical public modules and symbols.",
    href: docsPathFor(docsApiRoute(route.packageSlug)),
    keywords: ["api", "modules", "functions", "types", "reference"]
  }
]

const normalized = (value: string): string => value.trim().toLocaleLowerCase()

export const filterDocsDestinations = (
  destinations: ReadonlyArray<DocsDestination>,
  query: string
): ReadonlyArray<DocsDestination> => {
  const term = normalized(query)

  return term.length === 0
    ? destinations
    : Arr.filter(destinations, (destination) =>
      normalized([
        destination.label,
        destination.description,
        ...destination.keywords
      ].join(" ")).includes(term))
}

export const docsPageCopyFor = (route: DocsRoute, card: Card): DocsPageCopy =>
  Match.value(route).pipe(
    Match.tag("DocsOverviewRoute", () => ({
      eyebrow: card.group === "effect" ? "Effect libraries" : "Content and cryptography",
      title: card.title,
      description: card.description
    })),
    Match.tag("DocsGettingStartedRoute", () => ({
      eyebrow: card.title,
      title: "Getting started",
      description: `Build a small, typed program with ${card.packageName} and Effect.`
    })),
    Match.tag("DocsApiRoute", ({ moduleSlug }) => ({
      eyebrow: `${card.title} API`,
      title: moduleSlug ?? "API reference",
      description: moduleSlug === null
        ? `Public modules and exports for ${card.packageName}.`
        : `Public declarations, signatures, and documentation for the ${moduleSlug} module.`
    })),
    Match.exhaustive
  )

export const docsSectionLabel = (section: DocsSection): string =>
  Match.value(section).pipe(
    Match.when("overview", () => "Learn"),
    Match.when("getting-started", () => "Learn"),
    Match.when("api", () => "Reference"),
    Match.exhaustive
  )
