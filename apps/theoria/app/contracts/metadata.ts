import { Option, Schema } from "effect"
import * as Arr from "effect/Array"

import type { DocsManifest } from "@theoria/docs-model"

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
  defaultDescription: "Open-source TypeScript libraries for scientific computing and model programming with Effect.",
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

const docsMetadata = (title: string, description: string, canonicalPath: string): PageMetadata => ({
  title,
  description,
  canonicalPath,
  ogType: "article"
})

const matchesDocsPath = (pathname: string, candidate: string): boolean =>
  pathname === candidate || pathname === `${candidate}/`

const packageContainingDocsPath = (manifest: DocsManifest, pathname: string) =>
  Arr.findFirst(
    manifest.packages,
    (docsPackage) =>
      matchesDocsPath(pathname, docsPackage.overview.path) ||
      Arr.some(docsPackage.guides, (guide) => matchesDocsPath(pathname, guide.path)) ||
      Arr.some(
        docsPackage.apiModules,
        (module) =>
          matchesDocsPath(pathname, module.path) ||
          Arr.some(module.aliases, (alias) => matchesDocsPath(pathname, alias))
      )
  )

export const docsPathExists = (manifest: DocsManifest, pathname: string): boolean =>
  pathname === "/docs" || pathname === "/docs/" || Option.isSome(packageContainingDocsPath(manifest, pathname))

export const metadataForDocs = (manifest: DocsManifest, pathname: string): PageMetadata => {
  if (pathname === "/docs" || pathname === "/docs/") {
    return docsMetadata("Packages — Theoria", siteMetadata.defaultDescription, "/docs")
  }

  return Option.match(packageContainingDocsPath(manifest, pathname), {
    onNone: () => docsMetadata("Not found — Theoria", siteMetadata.defaultDescription, "/docs"),
    onSome: (docsPackage) =>
      Option.match(
        Arr.findFirst(docsPackage.guides, (guide) => matchesDocsPath(pathname, guide.path)),
        {
          onNone: () =>
            Option.match(
              Arr.findFirst(
                docsPackage.apiModules,
                (module) =>
                  matchesDocsPath(pathname, module.path) ||
                  Arr.some(module.aliases, (alias) => matchesDocsPath(pathname, alias))
              ),
              {
                onNone: () =>
                  docsMetadata(`${docsPackage.name} — Theoria`, docsPackage.description, docsPackage.overview.path),
                onSome: (module) =>
                  docsMetadata(`${module.name} — ${docsPackage.name} — Theoria`, module.summary, module.path)
              }
            ),
          onSome: (guide) => docsMetadata(`${guide.title} — ${docsPackage.name} — Theoria`, guide.summary, guide.path)
        }
      )
  })
}

/**
 * Join a canonical path with the site URL to produce a fully-qualified URL.
 *
 * @since 0.1.0
 */
export const fullCanonicalUrl = (canonicalPath: string): string => `${siteMetadata.siteUrl}${canonicalPath}`
