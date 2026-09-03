import { Match, Schema } from "effect"
import * as Arr from "effect/Array"

import { fullCanonicalUrl, type PageMetadata, siteMetadata } from "./metadata.js"

/**
 * Schema.org JSON-LD for a page, derived from its `PageMetadata`.
 *
 * Every page carries the `WebSite` node and the publishing `Organization`.
 * The organization reuses the `@id` published on scenesystems.io so search
 * engines treat both sites as the same entity. Package pages add a
 * `SoftwareSourceCode`; guides and API modules add a `TechArticle`; both add a
 * `BreadcrumbList`.
 */

type JsonValue = string | number | boolean | ReadonlyArray<JsonValue> | { readonly [key: string]: JsonValue }

const organizationId = "https://scenesystems.io/#organization"
const websiteId = `${siteMetadata.siteUrl}/#website`
const homeUrl = fullCanonicalUrl("/")

const organization: JsonValue = {
  "@type": "Organization",
  "@id": organizationId,
  name: "Scene",
  legalName: "SCENE Systems, Inc.",
  url: "https://scenesystems.io/",
  logo: {
    "@type": "ImageObject",
    url: "https://scenesystems.io/brand/scene-mark.png",
    width: 512,
    height: 512
  },
  sameAs: [
    "https://github.com/scenesystems",
    "https://www.linkedin.com/company/scenesystems",
    "https://x.com/scenesystems"
  ]
}

const website: JsonValue = {
  "@type": "WebSite",
  "@id": websiteId,
  url: homeUrl,
  name: siteMetadata.siteName,
  description: siteMetadata.defaultDescription,
  inLanguage: "en",
  publisher: { "@id": organizationId }
}

const breadcrumbId = (metadata: PageMetadata): string => `${fullCanonicalUrl(metadata.canonicalPath)}#breadcrumb`

const breadcrumbList = (metadata: PageMetadata): JsonValue => ({
  "@type": "BreadcrumbList",
  "@id": breadcrumbId(metadata),
  itemListElement: Arr.map(
    Arr.prepend(metadata.breadcrumbs, { name: siteMetadata.siteName, path: "/" }),
    (crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: fullCanonicalUrl(crumb.path)
    })
  )
})

const pageCommon = (metadata: PageMetadata) => ({
  url: fullCanonicalUrl(metadata.canonicalPath),
  description: metadata.description,
  image: fullCanonicalUrl(metadata.image.path),
  inLanguage: "en",
  isPartOf: { "@id": websiteId },
  breadcrumb: { "@id": breadcrumbId(metadata) }
})

const pageNodes = (metadata: PageMetadata): ReadonlyArray<JsonValue> =>
  Match.value(metadata.kind).pipe(
    Match.tag("Home", (): ReadonlyArray<JsonValue> => []),
    Match.tag("Missing", (): ReadonlyArray<JsonValue> => []),
    Match.tag("Catalog", (): ReadonlyArray<JsonValue> => [
      { "@type": "CollectionPage", name: metadata.title, ...pageCommon(metadata) },
      breadcrumbList(metadata)
    ]),
    Match.tag("Package", (kind): ReadonlyArray<JsonValue> => [
      {
        "@type": "SoftwareSourceCode",
        name: kind.packageName,
        version: kind.version,
        codeRepository: kind.repositoryUrl,
        programmingLanguage: { "@type": "ComputerLanguage", name: "TypeScript" },
        license: "https://opensource.org/license/mit",
        sameAs: [kind.npmUrl],
        author: { "@id": organizationId },
        ...pageCommon(metadata)
      },
      breadcrumbList(metadata)
    ]),
    Match.tag("Article", (kind): ReadonlyArray<JsonValue> => [
      {
        "@type": "TechArticle",
        headline: kind.headline,
        about: { "@type": "SoftwareSourceCode", name: kind.packageName, url: fullCanonicalUrl(kind.packagePath) },
        author: { "@id": organizationId },
        publisher: { "@id": organizationId },
        ...pageCommon(metadata)
      },
      breadcrumbList(metadata)
    ]),
    Match.exhaustive
  )

const encodeJson = Schema.encodeSync(Schema.parseJson(Schema.Unknown))

/**
 * The JSON-LD document for a page, safe to place inside a `<script>` element:
 * `<` is escaped so `</script>` can never appear in the output.
 *
 * @since 0.1.0
 */
export const structuredDataJson = (metadata: PageMetadata): string =>
  encodeJson({
    "@context": "https://schema.org",
    "@graph": [...pageNodes(metadata), website, organization]
  }).replace(/</gu, "\\u003c")
