import { Schema } from "effect"

import { fullCanonicalUrl, type PageMetadata } from "./metadata.js"
import { structuredDataJson } from "./structured-data.js"

/**
 * The per-route `<head>` content, as data. `index.html` holds one placeholder
 * element for each entry; the Worker rewrites them before serving the shell
 * (`app/server/routes/static.ts`) and the browser updates them on client-side
 * navigation (`app/web/services/browser-metadata.ts`). Both derive from the
 * same list, so the two renderings cannot drift apart.
 */
export const HeadTitle = Schema.TaggedStruct("Title", { text: Schema.String })
export const HeadMeta = Schema.TaggedStruct("Meta", {
  attribute: Schema.Literal("name", "property"),
  key: Schema.String,
  content: Schema.String
})
export const HeadCanonical = Schema.TaggedStruct("Canonical", { href: Schema.String })
export const HeadStructuredData = Schema.TaggedStruct("StructuredData", { json: Schema.String })
export const HeadEntry = Schema.Union(HeadTitle, HeadMeta, HeadCanonical, HeadStructuredData)
export type HeadEntry = typeof HeadEntry.Type

/** The `id` of the JSON-LD placeholder in `index.html`. */
export const structuredDataElementId = "structured-data"

const named = (key: string, content: string): HeadEntry => HeadMeta.make({ attribute: "name", key, content })
const property = (key: string, content: string): HeadEntry => HeadMeta.make({ attribute: "property", key, content })

/** `max-image-preview:large` lets Google show the share image at full size in results. */
const robotsDirective = (indexable: boolean): string =>
  indexable ? "index, follow, max-image-preview:large" : "noindex, follow"

export const headEntries = (metadata: PageMetadata): ReadonlyArray<HeadEntry> => {
  const canonicalUrl = fullCanonicalUrl(metadata.canonicalPath)
  const imageUrl = fullCanonicalUrl(metadata.image.path)

  return [
    HeadTitle.make({ text: metadata.title }),
    named("description", metadata.description),
    named("robots", robotsDirective(metadata.indexable)),
    property("og:title", metadata.title),
    property("og:description", metadata.description),
    property("og:url", canonicalUrl),
    property("og:type", metadata.ogType),
    property("og:image", imageUrl),
    property("og:image:alt", metadata.image.alt),
    named("twitter:title", metadata.title),
    named("twitter:description", metadata.description),
    named("twitter:image", imageUrl),
    named("twitter:image:alt", metadata.image.alt),
    HeadCanonical.make({ href: canonicalUrl }),
    HeadStructuredData.make({ json: structuredDataJson(metadata) })
  ]
}
