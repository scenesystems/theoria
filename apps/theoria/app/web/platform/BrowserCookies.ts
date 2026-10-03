import { Effect, Layer, type Option, Record, Result } from "effect"
import * as Cookies from "effect/http/Cookies"
import * as KeyValueStore from "effect/persistence/KeyValueStore"

import { colorModeCookieOptions, preferenceCookieRemoval } from "../../contracts/color-mode.js"
import { BrowserDocument } from "./BrowserDocument.js"

/**
 * The document's cookies as the platform `KeyValueStore`, so a preference the
 * Worker must know before the page runs a line of script — the colour mode —
 * is kept where every request carries it. `Atom.kvs` reads and writes this
 * store as it would any other; the Worker reads the same cookie with
 * `HttpServerRequest.schemaCookies`.
 *
 * Every cookie written here takes the colour-mode cookie's options: a year,
 * site-wide, first-party. The store holds small, harmless preferences and
 * nothing else; anything larger belongs in a store that never crosses the
 * wire.
 *
 * @since 0.3.0
 */

const cookieError = (method: string, key: string, message: string): KeyValueStore.KeyValueStoreError =>
  new KeyValueStore.KeyValueStoreError({
    method,
    key,
    message
  })

/** Writes one cookie, or fails when its name or value cannot travel in a `Cookie` header. */
const write = (
  browserDocument: Document,
  key: string,
  value: string,
  options: Cookies.Cookie["options"]
): Effect.Effect<void, KeyValueStore.KeyValueStoreError> =>
  Result.match(Cookies.makeCookie(key, value, options), {
    onFailure: (error) => Effect.fail(cookieError("set", key, error.message)),
    onSuccess: (cookie) =>
      Effect.sync(() => {
        browserDocument.cookie = Cookies.serializeCookie(cookie)
      })
  })

const read = (browserDocument: Document): Effect.Effect<Record.ReadonlyRecord<string, string>> =>
  Effect.sync(() => Cookies.parseHeader(browserDocument.cookie))

const make = (browserDocument: Document): KeyValueStore.KeyValueStore =>
  KeyValueStore.makeStringOnly({
    get: (key) => Effect.map(read(browserDocument), (cookies) => cookies[key]),
    set: (key, value) => write(browserDocument, key, value, colorModeCookieOptions),
    remove: (key) => write(browserDocument, key, "", preferenceCookieRemoval),
    clear: Effect.flatMap(
      read(browserDocument),
      (cookies) =>
        Effect.forEach(Record.keys(cookies), (key) => write(browserDocument, key, "", preferenceCookieRemoval), {
          discard: true
        })
    ),
    size: Effect.map(read(browserDocument), Record.size)
  })

/** The cookie store over the ambient document. */
export const layerKeyValueStore: Layer.Layer<KeyValueStore.KeyValueStore, never, BrowserDocument> = Layer.effect(
  KeyValueStore.KeyValueStore,
  Effect.map(BrowserDocument, make)
)

/** The value of one cookie as the document has it now, decoded. */
export const value = (name: string): Effect.Effect<Option.Option<string>, never, BrowserDocument> =>
  Effect.flatMap(BrowserDocument, (browserDocument) => Effect.map(read(browserDocument), Record.get(name)))
