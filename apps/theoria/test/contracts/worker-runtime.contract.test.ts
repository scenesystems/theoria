import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

/** The two manifests' dependency tables, read as the package manager reads them. */
const Manifest = Schema.parseJson(Schema.Struct({
  dependencies: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.String }), {
    default: () => ({})
  }),
  devDependencies: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.String }), {
    default: () => ({})
  })
}))

/** The app's directory, from this file rather than the working directory: the root test run starts elsewhere. */
const appRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path
  return yield* path.fromFileUrl(yield* Url.fromString("../../", import.meta.url))
}).pipe(Effect.orDie)

const readManifest = (file: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    return yield* Schema.decode(Manifest)(yield* fileSystem.readFileString(file))
  }).pipe(Effect.orDie)

describe("Worker runtime contract", () => {
  it.effect("the Worker tests hold the same Miniflare that Wrangler bundles, so both read one workerd", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const root = yield* appRoot
      const app = yield* readManifest(path.join(root, "package.json"))
      const wrangler = yield* readManifest(path.join(root, "node_modules", "wrangler", "package.json"))

      // `test/worker/site.ts` runs the deploy bundle in Miniflare directly,
      // configured by Wrangler's reader; a Miniflare of another version
      // would take that configuration into another runtime than the one
      // `wrangler deploy` and `wrangler dev` use.
      expect(app.devDependencies.miniflare).toBe(wrangler.dependencies.miniflare)
    }).pipe(Effect.provide(BunContext.layer)))
})
