import { Option, Schema } from "effect"
import * as Arr from "effect/Array"

import type { DocsManifest, DocsPackageSummary } from "@theoria/docs-model"

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
  locale: Schema.Literal("en_US"),
  repositoryUrl: Schema.Literal("https://github.com/scenesystems/theoria")
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
    "Open-source TypeScript libraries for numerics, optimization, language-model programming, text layout, and cryptography, built with Effect.",
  twitterHandle: "@scenesystems",
  locale: "en_US",
  repositoryUrl: "https://github.com/scenesystems/theoria"
}

/**
 * The share image for a page. Every image is a committed 1200×630 PNG under
 * `public/social/`, rendered by `scripts/generate-social-assets.ts`.
 *
 * @since 0.1.0
 */
export const ShareImage = Schema.Struct({
  path: NonEmptyString,
  alt: NonEmptyString
})

export type ShareImage = typeof ShareImage.Type

/**
 * One level of the page's location within the site, home excluded.
 *
 * @since 0.1.0
 */
export const Breadcrumb = Schema.Struct({
  name: NonEmptyString,
  path: NonEmptyString
})

export type Breadcrumb = typeof Breadcrumb.Type

/**
 * What kind of page the metadata describes; drives structured data.
 *
 * @since 0.1.0
 */
export const PageKind = Schema.Union(
  Schema.TaggedStruct("Home", {}),
  Schema.TaggedStruct("Catalog", {}),
  Schema.TaggedStruct("Package", {
    packageName: NonEmptyString,
    version: NonEmptyString,
    repositoryUrl: NonEmptyString,
    npmUrl: NonEmptyString
  }),
  Schema.TaggedStruct("Article", {
    headline: NonEmptyString,
    packageName: NonEmptyString,
    packagePath: NonEmptyString
  }),
  Schema.TaggedStruct("Missing", {})
)

export type PageKind = typeof PageKind.Type

/**
 * Per-page SEO metadata contract.
 *
 * @since 0.1.0
 */
export const PageMetadata = Schema.Struct({
  title: NonEmptyString,
  description: NonEmptyString,
  canonicalPath: NonEmptyString,
  ogType: OgType,
  image: ShareImage,
  indexable: Schema.Boolean,
  breadcrumbs: Schema.Array(Breadcrumb),
  kind: PageKind
})

export type PageMetadata = typeof PageMetadata.Type

const siteImage: ShareImage = {
  path: "/social/theoria.png",
  alt: "Theoria — open-source TypeScript libraries built with Effect"
}

const packageImage = (docsPackage: DocsPackageSummary): ShareImage => ({
  path: `/social/${docsPackage.slug}.png`,
  alt: `${docsPackage.name} — ${docsPackage.description}`
})

const catalogCrumb: Breadcrumb = { name: "Packages", path: "/docs" }

/**
 * Page metadata for the home page.
 *
 * @since 0.1.0
 */
export const metadataForHome = (): PageMetadata => ({
  title: siteMetadata.defaultTitle,
  description: siteMetadata.defaultDescription,
  canonicalPath: "/",
  ogType: "website",
  image: siteImage,
  indexable: true,
  breadcrumbs: [],
  kind: { _tag: "Home" }
})

const catalogMetadata: PageMetadata = {
  title: "Packages — Theoria",
  description: siteMetadata.defaultDescription,
  canonicalPath: "/docs",
  ogType: "website",
  image: siteImage,
  indexable: true,
  breadcrumbs: [catalogCrumb],
  kind: { _tag: "Catalog" }
}

const missingMetadata: PageMetadata = {
  title: "Not found — Theoria",
  description: siteMetadata.defaultDescription,
  canonicalPath: "/docs",
  ogType: "website",
  image: siteImage,
  indexable: false,
  breadcrumbs: [catalogCrumb],
  kind: { _tag: "Missing" }
}

const packageMetadata = (docsPackage: DocsPackageSummary): PageMetadata => ({
  title: `${docsPackage.name} — Theoria`,
  description: docsPackage.description,
  canonicalPath: docsPackage.overview.path,
  ogType: "article",
  image: packageImage(docsPackage),
  indexable: true,
  breadcrumbs: [catalogCrumb, { name: docsPackage.name, path: docsPackage.overview.path }],
  kind: {
    _tag: "Package",
    packageName: docsPackage.name,
    version: docsPackage.version,
    repositoryUrl: docsPackage.repositoryUrl,
    npmUrl: docsPackage.npmUrl
  }
})

const articleMetadata = (
  docsPackage: DocsPackageSummary,
  headline: string,
  summary: string,
  path: string
): PageMetadata => ({
  title: `${headline} — ${docsPackage.name} — Theoria`,
  description: summary,
  canonicalPath: path,
  ogType: "article",
  image: packageImage(docsPackage),
  indexable: true,
  breadcrumbs: [catalogCrumb, { name: docsPackage.name, path: docsPackage.overview.path }, { name: headline, path }],
  kind: { _tag: "Article", headline, packageName: docsPackage.name, packagePath: docsPackage.overview.path }
})

const matchesDocsPath = (pathname: string, candidate: string): boolean =>
  pathname === candidate || pathname === `${candidate}/`

const guideAt = (docsPackage: DocsPackageSummary, pathname: string) =>
  Arr.findFirst(docsPackage.guides, (guide) => matchesDocsPath(pathname, guide.path))

const moduleAt = (docsPackage: DocsPackageSummary, pathname: string) =>
  Arr.findFirst(
    docsPackage.apiModules,
    (module) =>
      matchesDocsPath(pathname, module.path) || Arr.some(module.aliases, (alias) => matchesDocsPath(pathname, alias))
  )

const packageContainingDocsPath = (manifest: DocsManifest, pathname: string) =>
  Arr.findFirst(
    manifest.packages,
    (docsPackage) =>
      matchesDocsPath(pathname, docsPackage.overview.path) ||
      Option.isSome(guideAt(docsPackage, pathname)) ||
      Option.isSome(moduleAt(docsPackage, pathname))
  )

const isCatalogPath = (pathname: string): boolean => pathname === "/docs" || pathname === "/docs/"

export const docsPathExists = (manifest: DocsManifest, pathname: string): boolean =>
  isCatalogPath(pathname) || Option.isSome(packageContainingDocsPath(manifest, pathname))

const metadataWithinPackage = (docsPackage: DocsPackageSummary, pathname: string): PageMetadata =>
  Option.match(guideAt(docsPackage, pathname), {
    onSome: (guide) => articleMetadata(docsPackage, guide.title, guide.summary, guide.path),
    onNone: () =>
      Option.match(moduleAt(docsPackage, pathname), {
        onSome: (module) => articleMetadata(docsPackage, module.name, module.summary, module.path),
        onNone: () => packageMetadata(docsPackage)
      })
  })

export const metadataForDocs = (manifest: DocsManifest, pathname: string): PageMetadata =>
  isCatalogPath(pathname)
    ? catalogMetadata
    : Option.match(packageContainingDocsPath(manifest, pathname), {
      onNone: () => missingMetadata,
      onSome: (docsPackage) => metadataWithinPackage(docsPackage, pathname)
    })

/**
 * Join a canonical path with the site URL to produce a fully-qualified URL.
 *
 * @since 0.1.0
 */
export const fullCanonicalUrl = (canonicalPath: string): string => `${siteMetadata.siteUrl}${canonicalPath}`
