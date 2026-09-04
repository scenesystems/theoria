import { Match, Option } from "effect"
import * as Arr from "effect/Array"

import { headEntries, type HeadEntry, structuredDataElementId } from "../../contracts/head.js"
import type { PageMetadata } from "../../contracts/metadata.js"

/**
 * Updates the `<head>` after client-side navigation so the document matches
 * what the Worker would have served for the new route. Only elements that
 * already exist in the shell are touched; the Worker owns their creation.
 */

/** Runs `update` against the shell element at `selector`; a missing element is the Worker's to create, not ours. */
const withShellElement = (element: Option.Option<HTMLElement>, update: (element: HTMLElement) => void): void =>
  Option.match(element, { onNone: () => {}, onSome: update })

const setAttribute = (selector: string, attribute: string, value: string): void =>
  withShellElement(
    Option.fromNullable(document.head.querySelector<HTMLElement>(selector)),
    (element) => element.setAttribute(attribute, value)
  )

const applyEntry = (entry: HeadEntry): void =>
  Match.value(entry).pipe(
    Match.tag("Title", ({ text }) => {
      document.title = text
    }),
    Match.tag("Meta", ({ attribute, content, key }) => setAttribute(`meta[${attribute}="${key}"]`, "content", content)),
    Match.tag("Canonical", ({ href }) => setAttribute("link[rel=\"canonical\"]", "href", href)),
    Match.tag("StructuredData", ({ json }) =>
      withShellElement(Option.fromNullable(document.getElementById(structuredDataElementId)), (element) => {
        element.textContent = json
      })),
    Match.exhaustive
  )

export const applyBrowserMetadata = (metadata: PageMetadata): void => {
  Arr.forEach(headEntries(metadata), applyEntry)
}
