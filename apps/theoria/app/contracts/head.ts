import { Data } from "effect"

import { fullCanonicalUrl, type PageMetadata } from "./metadata.js"
import { structuredDataJson } from "./structured-data.js"

/**
 * The per-route `<head>` content, as data. `index.html` holds one placeholder
 * element for each entry; the Worker rewrites them before serving the shell
 * (`app/server/routes/static.ts`) and the browser updates them on client-side
 * navigation (`app/web/services/browser-metadata.ts`). Both derive from the
 * same list, so the two renderings cannot drift apart.
 */
export type HeadEntry = Data.TaggedEnum<{
  Title: { readonly text: string }
  Meta: { readonly attribute: "name" | "property"; readonly key: string; readonly content: string }
  Canonical: { readonly href: string }
  StructuredData: { readonly json: string }
}>

export const HeadEntry = Data.taggedEnum<HeadEntry>()

/** The `id` of the JSON-LD placeholder in `index.html`. */
export const structuredDataElementId = "structured-data"

const named = (key: string, content: string): HeadEntry => HeadEntry.Meta({ attribute: "name", key, content })
const property = (key: string, content: string): HeadEntry => HeadEntry.Meta({ attribute: "property", key, content })

/** `max-image-preview:large` lets Google show the share image at full size in results. */
const robotsDirective = (indexable: boolean): string =>
  indexable ? "index, follow, max-image-preview:large" : "noindex, follow"

export const headEntries = (metadata: PageMetadata): ReadonlyArray<HeadEntry> => {
  const canonicalUrl = fullCanonicalUrl(metadata.canonicalPath)
  const imageUrl = fullCanonicalUrl(metadata.image.path)

  return [
    HeadEntry.Title({ text: metadata.title }),
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
    HeadEntry.Canonical({ href: canonicalUrl }),
    HeadEntry.StructuredData({ json: structuredDataJson(metadata) })
  ]
}
