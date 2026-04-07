import type { PackageName } from "@theoria/source-proof/contracts"
import { Option, Schema } from "effect"

import { type Card, cards } from "./card.js"
import { isPublishedConsumerId, type PublishedConsumerId } from "./id.js"
import { openAgentTracePagePath } from "./open-agent-trace.js"
import { packageDocsPagePath } from "./package-docs.js"
import { type PublishedConsumerPresentation, publishedConsumerPresentationForId } from "./proving-substrate.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

/**
 * Open Graph page type discriminator.
 *
 * @since 0.1.0
 */
export const OgType = Schema.Literal("website", "article")

export type OgType = typeof OgType.Type

/**
 * Site-level metadata schema shared across all pages.
 *
 * @since 0.1.0
 */
export const SiteMetadata = Schema.Struct({
  siteName: Schema.Literal("Theoria"),
  siteUrl: Schema.Literal("https://theoria.scenesystems.io"),
  defaultTitle: Schema.Literal("Theoria — Scene Systems"),
  defaultDescription: NonEmptyString,
  twitterHandle: Schema.Literal("@scenesystems"),
  locale: Schema.Literal("en_US")
})

export type SiteMetadata = typeof SiteMetadata.Type

/**
 * Canonical site metadata instance.
 *
 * @since 0.1.0
 */
export const siteMetadata: SiteMetadata = {
  siteName: "Theoria",
  siteUrl: "https://theoria.scenesystems.io",
  defaultTitle: "Theoria — Scene Systems",
  defaultDescription:
    "Interactive demonstrations of typed, composable libraries for scientific computing, optimization, and language model programming built with Effect.",
  twitterHandle: "@scenesystems",
  locale: "en_US"
}

/**
 * Per-page SEO metadata contract.
 *
 * @since 0.1.0
 */
export const PageMetadata = Schema.Struct({
  title: NonEmptyString,
  description: NonEmptyString,
  canonicalPath: NonEmptyString,
  ogType: OgType
})

export type PageMetadata = typeof PageMetadata.Type

/**
 * Page metadata for the home page.
 *
 * @since 0.1.0
 */
export const metadataForHome = (): PageMetadata => ({
  title: siteMetadata.defaultTitle,
  description: siteMetadata.defaultDescription,
  canonicalPath: "/",
  ogType: "website"
})

/**
 * Page metadata derived from a published consumer presentation.
 *
 * @since 0.1.0
 */
export const metadataForPublishedConsumer = (
  presentation: PublishedConsumerPresentation
): PageMetadata => ({
  title: `${presentation.title} — Theoria`,
  description: presentation.description,
  canonicalPath: presentation.deepDivePath,
  ogType: "article"
})

const cardByPackageName = (packageName: PackageName): Option.Option<Card> =>
  Option.fromNullable(cards.find((card) => card.packageName === packageName))

export const metadataForPackageDocs = (packageId: PackageName | null): PageMetadata =>
  Option.match(Option.fromNullable(packageId).pipe(Option.flatMap(cardByPackageName)), {
    onNone: () => ({
      title: "Package Docs — Theoria",
      description: "Source-linked package documentation projected from the canonical Theoria release surfaces.",
      canonicalPath: packageDocsPagePath(packageId),
      ogType: "article"
    }),
    onSome: (card) => ({
      title: `${card.title} Docs — Theoria`,
      description: `${card.description} Source-linked package docs, examples, release snapshots, and proof commands.`,
      canonicalPath: packageDocsPagePath(packageId),
      ogType: "article"
    })
  })

export const metadataForOpenAgentTracePage = (): PageMetadata => ({
  title: "Open Agent Trace — Theoria",
  description:
    "Read-only evidentiary inspection over the experimental effect-dsp open-agent-trace corpus lane, consuming package-owned normalization, workflow projection, coverage, and digest truth.",
  canonicalPath: openAgentTracePagePath(),
  ogType: "article"
})

/**
 * Page metadata for a published consumer identified by id, falling back to home
 * metadata when the ID is unknown.
 *
 * @since 0.1.0
 */
export const metadataForId = (id: string): PageMetadata =>
  isPublishedConsumerId(id)
    ? metadataForPublishedConsumerId(id)
    : metadataForHome()

export const metadataForPublishedConsumerId = (id: PublishedConsumerId): PageMetadata =>
  metadataForPublishedConsumer(publishedConsumerPresentationForId(id))

/**
 * Join a canonical path with the site URL to produce a fully-qualified URL.
 *
 * @since 0.1.0
 */
export const fullCanonicalUrl = (canonicalPath: string): string => `${siteMetadata.siteUrl}${canonicalPath}`
