import type { PackageName } from "@theoria/source-proof/contracts"
import { Option, Schema } from "effect"

import { type EntryId, isEntryId } from "../entry/id.js"
import { EntryPresentation, type EntryPresentation as EntryPresentationShape } from "../entry/routing.js"
import { publishedWorkflowCatalogEntryForSeedId } from "../study/workflow/catalog-policy.js"
import {
  PackageDocsLandingPageRoute,
  PackageDocsPackagePageRoute,
  type PackageDocsPageRoute,
  PackageDocsPresentation
} from "./package-docs.js"
import type { WorkflowStudyRoute } from "./path.js"

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
export class SiteMetadata extends Schema.Class<SiteMetadata>("SiteMetadata")({
  siteName: Schema.Literal("Theoria"),
  siteUrl: Schema.Literal("https://theoria.scenesystems.io"),
  defaultTitle: Schema.Literal("Theoria — Scene Systems"),
  defaultDescription: NonEmptyString,
  twitterHandle: Schema.Literal("@scenesystems"),
  locale: Schema.Literal("en_US")
}) {
  static readonly currentValue = SiteMetadata.make({
    siteName: "Theoria",
    siteUrl: "https://theoria.scenesystems.io",
    defaultTitle: "Theoria — Scene Systems",
    defaultDescription:
      "Integrated study system for typed, composable computation, optimization, inference, and evidence workflows built with Effect.",
    twitterHandle: "@scenesystems",
    locale: "en_US"
  })

  static current(): SiteMetadata {
    return SiteMetadata.currentValue
  }

  static fullCanonicalUrl(canonicalPath: string): string {
    return `${SiteMetadata.current().siteUrl}${canonicalPath}`
  }
}

/**
 * Per-page SEO metadata contract.
 *
 * @since 0.1.0
 */
export class PageMetadata extends Schema.Class<PageMetadata>("PageMetadata")({
  title: NonEmptyString,
  description: NonEmptyString,
  canonicalPath: NonEmptyString,
  ogType: OgType
}) {
  static fromEntry(presentation: EntryPresentationShape): PageMetadata {
    return PageMetadata.make({
      title: `${presentation.title} — Theoria`,
      description: presentation.description,
      canonicalPath: presentation.path,
      ogType: "article"
    })
  }

  static fromEntryId(id: EntryId): PageMetadata {
    return PageMetadata.fromEntry(EntryPresentation.fromEntryId(id))
  }

  static fromWorkflowStudyRoute(route: WorkflowStudyRoute): PageMetadata {
    const catalogEntry = publishedWorkflowCatalogEntryForSeedId(route.sessionId)

    return catalogEntry.pipe(
      Option.match({
        onNone: () =>
          PageMetadata.make({
            title: "Workflow Session — Theoria",
            description: "Inspect one workflow study session by its durable workflow seed.",
            canonicalPath: route.path(),
            ogType: "article"
          }),
        onSome: (entry) =>
          PageMetadata.make({
            title: `${entry.label} Workflow Study — Theoria`,
            description: entry.summary,
            canonicalPath: route.path(),
            ogType: "article"
          })
      })
    )
  }

  static fromId(id: string): PageMetadata {
    return isEntryId(id)
      ? PageMetadata.fromEntryId(id)
      : PageMetadata.home()
  }

  static fromPackageDocsRoute(route: PackageDocsPageRoute): PageMetadata {
    const presentation = PackageDocsPresentation.project(route)

    return PageMetadata.make({
      title: presentation.metadataTitle,
      description: presentation.metadataDescription,
      canonicalPath: presentation.canonicalPath,
      ogType: "article"
    })
  }

  static fromPackageId(packageId: PackageName | null): PageMetadata {
    return PageMetadata.fromPackageDocsRoute(
      packageId === null
        ? PackageDocsLandingPageRoute.landing()
        : PackageDocsPackagePageRoute.fromPackageId(packageId)
    )
  }

  static home(): PageMetadata {
    const site = SiteMetadata.current()

    return PageMetadata.make({
      title: site.defaultTitle,
      description: site.defaultDescription,
      canonicalPath: "/",
      ogType: "website"
    })
  }
}
