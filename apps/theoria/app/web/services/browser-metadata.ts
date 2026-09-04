import { Effect, Match, Option } from "effect"

import { headEntries, type HeadEntry, structuredDataElementId } from "../../contracts/head.js"
import type { PageMetadata } from "../../contracts/metadata.js"
import * as BrowserDocument from "../platform/BrowserDocument.js"

/**
 * Updates the `<head>` after client-side navigation so the document matches
 * what the Worker would have served for the new route. Only elements that
 * already exist in the shell are touched; the Worker owns their creation.
 */

/** Runs `update` against a shell element; a missing element is the Worker's to create, not ours. */
const withShellElement = (
  element: Effect.Effect<Option.Option<HTMLElement>, never, BrowserDocument.BrowserDocument>,
  update: (element: HTMLElement) => void
): Effect.Effect<void, never, BrowserDocument.BrowserDocument> =>
  Effect.map(element, Option.match({ onNone: () => {}, onSome: update }))

const setHeadAttribute = (
  selector: string,
  attribute: string,
  value: string
): Effect.Effect<void, never, BrowserDocument.BrowserDocument> =>
  withShellElement(BrowserDocument.headElement(selector), (element) => element.setAttribute(attribute, value))

const applyEntry = (entry: HeadEntry): Effect.Effect<void, never, BrowserDocument.BrowserDocument> =>
  Match.value(entry).pipe(
    Match.tag("Title", ({ text }) => BrowserDocument.setTitle(text)),
    Match.tag(
      "Meta",
      ({ attribute, content, key }) => setHeadAttribute(`meta[${attribute}="${key}"]`, "content", content)
    ),
    Match.tag("Canonical", ({ href }) => setHeadAttribute("link[rel=\"canonical\"]", "href", href)),
    Match.tag(
      "StructuredData",
      ({ json }) =>
        withShellElement(BrowserDocument.elementById(structuredDataElementId), (element) => {
          element.textContent = json
        })
    ),
    Match.exhaustive
  )

export const applyBrowserMetadata = (
  metadata: PageMetadata
): Effect.Effect<void, never, BrowserDocument.BrowserDocument> =>
  Effect.forEach(headEntries(metadata), applyEntry, { discard: true })
