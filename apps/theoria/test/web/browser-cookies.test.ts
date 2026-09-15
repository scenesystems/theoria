import { Cookies, KeyValueStore } from "@effect/platform"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option, Schema } from "effect"

import { colorModeCookieName, ColorModeCookies, ColorModePreference } from "../../app/contracts/color-mode.js"
import * as BrowserCookies from "../../app/web/platform/BrowserCookies.js"
import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"

/**
 * The cookie store is the browser's half of the colour-mode contract: what it
 * writes, the Worker must decode with `ColorModeCookies` from the request's
 * `Cookie` header. These tests round-trip through that header, not through
 * the store's own reader.
 */

const storeLayer = BrowserCookies.layerKeyValueStore.pipe(Layer.provide(BrowserDocument.layer))

/** The document's cookies as the Worker sees them: a `Cookie` header, decoded by the Worker's schema. */
const asTheWorkerReads = Effect.flatMap(
  BrowserDocument.BrowserDocument,
  (browserDocument) => Schema.decodeUnknown(ColorModeCookies)(Cookies.parseHeader(browserDocument.cookie))
)

/** Leaves the document with no colour-mode cookie once the test is done, whatever it wrote. */
const clean = Effect.orDie(Effect.flatMap(KeyValueStore.KeyValueStore, (store) => store.remove(colorModeCookieName)))

const withStore = <A, E>(use: Effect.Effect<A, E, KeyValueStore.KeyValueStore | BrowserDocument.BrowserDocument>) =>
  Effect.ensuring(use, clean).pipe(Effect.provide(Layer.merge(storeLayer, BrowserDocument.layer)))

describe("the cookie key-value store", () => {
  it.effect("writes a preference the Worker decodes from the Cookie header", () =>
    withStore(Effect.gen(function*() {
      const store = (yield* KeyValueStore.KeyValueStore).forSchema(ColorModePreference)
      yield* store.set(colorModeCookieName, "dark")

      const cookies = yield* asTheWorkerReads
      expect(cookies[colorModeCookieName]).toStrictEqual(Option.some("dark"))
    })))

  it.effect("reads back the value it wrote, and a later write replaces it", () =>
    withStore(Effect.gen(function*() {
      const store = (yield* KeyValueStore.KeyValueStore).forSchema(ColorModePreference)
      yield* store.set(colorModeCookieName, "light")
      yield* store.set(colorModeCookieName, "system")

      expect(yield* store.get(colorModeCookieName)).toStrictEqual(Option.some("system"))
      expect((yield* asTheWorkerReads)[colorModeCookieName]).toStrictEqual(Option.some("system"))
    })))

  it.effect("removes a cookie by expiring it, so the Worker sees no preference", () =>
    withStore(Effect.gen(function*() {
      const store = yield* KeyValueStore.KeyValueStore
      yield* store.set(colorModeCookieName, "\"dark\"")
      yield* store.remove(colorModeCookieName)

      expect(yield* store.has(colorModeCookieName)).toBe(false)
      expect((yield* asTheWorkerReads)[colorModeCookieName]).toStrictEqual(Option.none())
    })))

  it.effect("keeps the store's view of a missing key as absence, not an empty string", () =>
    withStore(Effect.gen(function*() {
      const store = yield* KeyValueStore.KeyValueStore
      expect(yield* store.get("never-written")).toStrictEqual(Option.none())
    })))

  it.effect("refuses a key that cannot be a cookie name as a platform error, not a silent no-op", () =>
    withStore(Effect.gen(function*() {
      const store = yield* KeyValueStore.KeyValueStore
      const failure = yield* Effect.flip(store.set("theoria/color-mode", "dark"))

      expect(failure).toMatchObject({
        _tag: "SystemError",
        reason: "InvalidData",
        module: "KeyValueStore",
        pathOrDescriptor: "theoria/color-mode"
      })
    })))
})
