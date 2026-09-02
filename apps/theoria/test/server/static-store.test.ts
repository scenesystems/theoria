import { FileSystem, HttpPlatform, HttpServerResponse } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"

import { contentTypeForPath, StaticStore } from "../../app/server/config/static-store.js"
import * as AssetsStaticStore from "../../app/server/platform/assets-static-store.js"
import * as BunStaticStore from "../../app/server/platform/bun-static-store.js"
import { failingAssets, fakeAssets } from "../helpers/fake-assets.js"

const bodyText = (response: HttpServerResponse.HttpServerResponse) =>
  Effect.tryPromise(() => HttpServerResponse.toWeb(response).text())

// ---------------------------------------------------------------------------
// Bun store (dist/ on disk)
// ---------------------------------------------------------------------------

const withDist = <A, E>(use: (store: StaticStore["Type"]) => Effect.Effect<A, E>) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const distRoot = yield* fileSystem.makeTempDirectoryScoped()

    yield* fileSystem.makeDirectory(`${distRoot}/assets`, { recursive: true })
    yield* fileSystem.writeFileString(`${distRoot}/index.html`, "<title>x</title>")
    yield* fileSystem.writeFileString(`${distRoot}/assets/app.js`, "console.log(1)")
    // The store never inflates sidecars; any bytes stand in for the gzip payload.
    yield* fileSystem.writeFileString(`${distRoot}/assets/app.js.gz`, "gzip-bytes")

    const store = yield* Effect.provide(StaticStore, BunStaticStore.layer(distRoot))

    return yield* use(store)
  }).pipe(Effect.scoped, Effect.provide(Layer.provideMerge(HttpPlatform.layer, BunContext.layer)))

it.effect("Bun store reads assets as text and reports missing ones", () =>
  withDist((store) =>
    Effect.gen(function*() {
      expect(yield* store.text("/index.html")).toBe("<title>x</title>")

      const error = yield* Effect.flip(store.text("/missing.html"))
      expect(error._tag).toBe("StaticStoreError")
    })
  ))

it.effect("Bun store streams assets with a content type and serves gzip sidecars", () =>
  withDist((store) =>
    Effect.gen(function*() {
      const plain = yield* store.response("/assets/app.js", Option.none())
      const plainResponse = Option.getOrThrow(plain)
      expect(plainResponse.headers["content-type"]).toBe("application/javascript; charset=utf-8")
      expect(plainResponse.headers["content-encoding"]).toBeUndefined()
      expect(yield* bodyText(plainResponse)).toBe("console.log(1)")

      const compressed = Option.getOrThrow(yield* store.response("/assets/app.js", Option.some("gzip, deflate, br")))
      expect(compressed.headers["content-encoding"]).toBe("gzip")
      expect(compressed.headers["content-type"]).toBe("application/javascript; charset=utf-8")
      expect(yield* bodyText(compressed)).toBe("gzip-bytes")

      const refused = yield* store.response("/assets/app.js", Option.some("gzip;q=0"))
      expect(Option.getOrThrow(refused).headers["content-encoding"]).toBeUndefined()
    })
  ))

it.effect("Bun store refuses traversal and missing files", () =>
  withDist((store) =>
    Effect.gen(function*() {
      expect(Option.isNone(yield* store.response("/../etc/passwd", Option.none()))).toBe(true)
      expect(Option.isNone(yield* store.response("/assets/nope.js", Option.none()))).toBe(true)
      expect(Option.isNone(yield* store.response("/assets/", Option.none()))).toBe(true)
    })
  ))

// ---------------------------------------------------------------------------
// Assets store (Cloudflare ASSETS binding)
// ---------------------------------------------------------------------------

const assetsStore = AssetsStaticStore.make(fakeAssets({
  "/index.html": "<title>x</title>",
  "/assets/app.js": "console.log(1)"
}))

it.effect("Assets store reads text through the binding", () =>
  Effect.gen(function*() {
    expect(yield* assetsStore.text("/index.html")).toBe("<title>x</title>")

    const error = yield* Effect.flip(assetsStore.text("/missing.html"))
    expect(error.message).toContain("404")
  }))

it.effect("Assets store forwards asset responses and preserves binding headers", () =>
  Effect.gen(function*() {
    const found = Option.getOrThrow(yield* assetsStore.response("/assets/app.js", Option.some("gzip")))
    expect(found.headers["content-type"]).toBe("application/javascript; charset=utf-8")
    expect(found.headers.etag).toBe("\"/assets/app.js\"")
    expect(yield* bodyText(found)).toBe("console.log(1)")

    expect(Option.isNone(yield* assetsStore.response("/nope", Option.none()))).toBe(true)
  }))

it.effect("Assets store treats binding failures as absent assets", () =>
  Effect.gen(function*() {
    const failing = AssetsStaticStore.make(failingAssets("boom"))

    expect(Option.isNone(yield* failing.response("/index.html", Option.none()))).toBe(true)
    const error = yield* Effect.flip(failing.text("/index.html"))
    expect(error._tag).toBe("StaticStoreError")
    expect(error.pathname).toBe("/index.html")
    expect(error.message).toContain("AssetsUnavailable")
  }))

it("maps common asset extensions to content types", () => {
  expect(contentTypeForPath("/favicon.svg")).toBe("image/svg+xml")
  expect(contentTypeForPath("/fonts/a.woff2")).toBe("font/woff2")
  expect(contentTypeForPath("/robots.txt")).toBe("text/plain; charset=utf-8")
})
