import { Boolean as Bool, Match, pipe } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import { type HeadEntry, structuredDataElementId } from "../contracts/head.js"

/**
 * Rewrites the placeholder `<head>` elements in the built `index.html` with a
 * page's `HeadEntry` values. Each entry matches exactly one element that the
 * shell already contains, so the output always has the same set of tags.
 */

/** Text as an attribute value or element body carries it. */
const escaped = (value: string): string =>
  pipe(
    value,
    Str.replaceAll("&", "&amp;"),
    Str.replaceAll("<", "&lt;"),
    Str.replaceAll(">", "&gt;"),
    Str.replaceAll("\"", "&quot;"),
    Str.replaceAll("'", "&#39;")
  )

/** A replacement string as `String.replace` reads it: a `$` is doubled so no `$&` or `$1` in content is a pattern. */
const literal = (value: string): string => Str.replaceAll("$", "$$$$")(value)

const titlePattern = /<title>[^<]*<\/title>/u
const canonicalPattern = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/u
const structuredDataPattern = new RegExp(
  `<script\\s+type="application/ld\\+json"\\s+id="${structuredDataElementId}">[^]*?</script>`,
  "u"
)
const metaPattern = (attribute: string, key: string): RegExp =>
  new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="[^"]*"\\s*/?>`, "u")
/** The root element with its language and, from an earlier rendering, a class. */
const rootPattern = /<html\s+lang="([^"]*)"(?:\s+class="[^"]*")?>/u

const rootElement = (name: string, present: boolean): string =>
  Bool.match(present, {
    onTrue: () => `<html lang="$1" class="${literal(escaped(name))}">`,
    onFalse: () => "<html lang=\"$1\">"
  })

const applyEntry = (html: string, entry: HeadEntry): string =>
  Match.value(entry).pipe(
    Match.tag("Title", ({ text }) => Str.replace(titlePattern, literal(`<title>${escaped(text)}</title>`))(html)),
    Match.tag("Meta", ({ attribute, content, key }) =>
      Str.replace(
        metaPattern(attribute, key),
        literal(`<meta ${attribute}="${key}" content="${escaped(content)}" />`)
      )(html)),
    Match.tag("Canonical", ({ href }) =>
      Str.replace(canonicalPattern, literal(`<link rel="canonical" href="${escaped(href)}" />`))(html)),
    Match.tag("StructuredData", ({ json }) =>
      Str.replace(
        structuredDataPattern,
        literal(`<script type="application/ld+json" id="${structuredDataElementId}">${json}</script>`)
      )(html)),
    Match.tag("RootClass", ({ name, present }) =>
      Str.replace(rootPattern, rootElement(name, present))(html)),
    Match.exhaustive
  )

export const renderHead = (html: string, entries: ReadonlyArray<HeadEntry>): string =>
  Arr.reduce(entries, html, applyEntry)
