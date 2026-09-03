import { Match } from "effect"
import * as Arr from "effect/Array"

import { type HeadEntry, structuredDataElementId } from "../contracts/head.js"

/**
 * Rewrites the placeholder `<head>` elements in the built `index.html` with a
 * page's `HeadEntry` values. Each entry matches exactly one element that the
 * shell already contains, so the output always has the same set of tags.
 */

const escaped = (value: string): string =>
  value.replace(/[&<>"']/gu, (character) =>
    Match.value(character).pipe(
      Match.when("&", () => "&amp;"),
      Match.when("<", () => "&lt;"),
      Match.when(">", () => "&gt;"),
      Match.when("\"", () => "&quot;"),
      Match.orElse(() => "&#39;")
    ))

const titlePattern = /<title>[^<]*<\/title>/u
const canonicalPattern = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/u
const structuredDataPattern = new RegExp(
  `<script\\s+type="application/ld\\+json"\\s+id="${structuredDataElementId}">[^]*?</script>`,
  "u"
)
const metaPattern = (attribute: string, key: string): RegExp =>
  new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="[^"]*"\\s*/?>`, "u")

const applyEntry = (html: string, entry: HeadEntry): string =>
  Match.value(entry).pipe(
    Match.tag("Title", ({ text }) => html.replace(titlePattern, () => `<title>${escaped(text)}</title>`)),
    Match.tag("Meta", ({ attribute, content, key }) =>
      html.replace(
        metaPattern(attribute, key),
        () => `<meta ${attribute}="${key}" content="${escaped(content)}" />`
      )),
    Match.tag("Canonical", ({ href }) =>
      html.replace(canonicalPattern, () => `<link rel="canonical" href="${escaped(href)}" />`)),
    Match.tag("StructuredData", ({ json }) =>
      html.replace(
        structuredDataPattern,
        () =>
          `<script type="application/ld+json" id="${structuredDataElementId}">${json}</script>`
      )),
    Match.exhaustive
  )

export const renderHead = (html: string, entries: ReadonlyArray<HeadEntry>): string =>
  Arr.reduce(entries, html, applyEntry)
