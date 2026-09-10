import { FileSystem, HttpPlatform, HttpServerResponse } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"

import { contentTypeForPath, StaticStore } from "../../app/server/config/static-store.js"
import * as BunStaticStore from "../../app/server/platform/bun-static-store.js"
import { cacheControlForPath } from "../../app/server/routes/static.js"

const bodyText = (response: HttpServerResponse.HttpServerResponse) =>
  Effect.tryPromise(() => HttpServerResponse.toWeb(response).text())

// ---------------------------------------------------------------------------
// Bun store (dist/ then public/ on disk)
// ---------------------------------------------------------------------------

const withDist = <A, E>(use: (store: StaticStore["Type"]) => Effect.Effect<A, E>) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const distRoot = yield* fileSystem.makeTempDirectoryScoped()
    const publicRoot = yield* fileSystem.makeTempDirectoryScoped()

    yield* fileSystem.makeDirectory(`${distRoot}/assets`, { recursive: true })
    yield* fileSystem.writeFileString(`${distRoot}/index.html`, "<title>x</title>")
    yield* fileSystem.writeFileString(`${distRoot}/assets/app.js`, "console.log(1)")
    yield* fileSystem.writeFile(
      `${distRoot}/assets/figtree-latin-wght-normal-D4qk9tSy.woff2`,
      new Uint8Array([0x77, 0x4f, 0x46, 0x32])
    )
    // `public/` holds a file `dist/` lacks, and a stale copy of one `dist/` has.
    yield* fileSystem.makeDirectory(`${publicRoot}/extra`, { recursive: true })
    yield* fileSystem.writeFileString(`${publicRoot}/extra/data.json`, "{\"public\":true}")
    yield* fileSystem.writeFileString(`${publicRoot}/index.html`, "<title>stale</title>")

    const store = yield* Effect.provide(StaticStore, BunStaticStore.layer([distRoot, publicRoot]))

    return yield* use(store)
  }).pipe(Effect.scoped, Effect.provide(Layer.provideMerge(HttpPlatform.layer, BunContext.layer)))

it.effect("Bun store searches roots in order and falls back to later roots", () =>
  withDist((store) =>
    Effect.gen(function*() {
      expect(yield* store.text("/index.html")).toBe("<title>x</title>")
      expect(yield* store.text("/extra/data.json")).toBe("{\"public\":true}")

      const fallback = yield* yield* store.response("/extra/data.json")
      expect(fallback.headers["content-type"]).toBe("application/json; charset=utf-8")
      expect(yield* bodyText(fallback)).toBe("{\"public\":true}")
    })
  ))

it.effect("Bun store reads assets as text and reports missing ones", () =>
  withDist((store) =>
    Effect.gen(function*() {
      expect(yield* store.text("/index.html")).toBe("<title>x</title>")

      const error = yield* Effect.flip(store.text("/missing.html"))
      expect(error._tag).toBe("StaticStoreError")
    })
  ))

it.effect("Bun store streams assets with a content type", () =>
  withDist((store) =>
    Effect.gen(function*() {
      const plain = yield* yield* store.response("/assets/app.js")
      expect(plain.headers["content-type"]).toBe("application/javascript; charset=utf-8")
      expect(plain.headers["content-encoding"]).toBeUndefined()
      expect(yield* bodyText(plain)).toBe("console.log(1)")
    })
  ))

// The content-type table is also the build gate (`checkBuildOutput`): a
// typeface in `dist/assets` with no type here fails the deploy before upload.
it.effect("Bun store serves typefaces as woff2, and the site keeps them for a year", () =>
  withDist((store) =>
    Effect.gen(function*() {
      const pathname = "/assets/figtree-latin-wght-normal-D4qk9tSy.woff2"
      expect(contentTypeForPath(pathname)).toEqual(Option.some("font/woff2"))
      const font = yield* yield* store.response(pathname)
      expect(font.headers["content-type"]).toBe("font/woff2")
      // A build asset, named by content hash, so a new file is a new URL.
      expect(cacheControlForPath(pathname)).toBe("public, max-age=31536000, immutable")
      // Nothing outside the build's assets is immutable by its path alone.
      expect(cacheControlForPath("/fonts/figtree.woff2")).toBe("public, max-age=3600")
    })
  ))

it.effect("Bun store refuses traversal and missing files", () =>
  withDist((store) =>
    Effect.gen(function*() {
      expect(Option.isNone(yield* store.response("/../etc/passwd"))).toBe(true)
      expect(Option.isNone(yield* store.response("/assets/nope.js"))).toBe(true)
      expect(Option.isNone(yield* store.response("/assets/"))).toBe(true)
    })
  ))
