import { FileSystem, HttpPlatform, HttpServerResponse } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"

import { StaticStore } from "../../app/server/config/static-store.js"
import * as BunStaticStore from "../../app/server/platform/bun-static-store.js"

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

      const fallback = Option.getOrThrow(yield* store.response("/extra/data.json"))
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
      const plain = Option.getOrThrow(yield* store.response("/assets/app.js"))
      expect(plain.headers["content-type"]).toBe("application/javascript; charset=utf-8")
      expect(plain.headers["content-encoding"]).toBeUndefined()
      expect(yield* bodyText(plain)).toBe("console.log(1)")
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
