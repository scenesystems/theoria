import { Match, Schema } from "effect"
import * as Arr from "effect/Array"

import type { Card } from "../../../contracts/card.js"
import { docsGettingStartedRoute, docsOverviewRoute, docsPathFor, type DocsRoute } from "../../../contracts/docs.js"

export const DocsDestination = Schema.Struct({
  section: Schema.Literal("overview", "getting-started", "api"),
  label: Schema.String,
  description: Schema.String,
  href: Schema.String,
  keywords: Schema.Array(Schema.String)
})

export type DocsDestination = typeof DocsDestination.Type

export const DocsPageCopy = Schema.Struct({
  context: Schema.NullOr(Schema.String),
  title: Schema.String,
  description: Schema.NullOr(Schema.String)
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
      context: null,
      title: card.title,
      description: card.description
    })),
    Match.tag("DocsGettingStartedRoute", () => ({
      context: card.title,
      title: "Getting started",
      description: null
    })),
    Match.tag("DocsApiRoute", ({ moduleSlug }) => ({
      context: card.title,
      title: moduleSlug ?? "API reference",
      description: null
    })),
    Match.exhaustive
  )
