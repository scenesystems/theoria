import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { renderTextTokensCss } from "../../app/web/text/textTokens.js"

/** The app's `app/web` directory, from this file rather than the working directory: the root test run starts elsewhere. */
const webRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path
  return yield* path.fromFileUrl(yield* Url.fromString("../../app/web/", import.meta.url))
}).pipe(Effect.orDie)

describe("Generated text tokens", () => {
  it.effect("the committed text tokens equal the typography authority's rendering", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* webRoot
      const generated = yield* fileSystem.readFileString(path.join(root, "text-tokens.generated.css"))

      expect(generated).toBe(renderTextTokensCss())
    }).pipe(Effect.provide(BunContext.layer)))
})
