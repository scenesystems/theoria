import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import { textSemantics } from "../../app/contracts/text.js"
import { renderTextTokensCss, semanticTextCandidates } from "../../app/web/text/textTokens.js"

/** The app's `app/web` directory, from this file rather than the working directory: the root test run starts elsewhere. */
const webRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path
  return yield* path.fromFileUrl(yield* Url.fromString("../../app/web/", import.meta.url))
}).pipe(Effect.orDie)

describe("Generated text tokens", () => {
  it.effect("matches the typography authority and covers every semantic candidate", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* webRoot
      const generated = yield* fileSystem.readFileString(path.join(root, "text-tokens.generated.css"))
      const styles = yield* fileSystem.readFileString(path.join(root, "styles.css"))

      expect(generated).toBe(renderTextTokensCss())
      expect(styles).not.toMatch(/^\s*--st-/m)
      expect(styles).not.toContain("max-width: 639px")
      expect(styles).not.toContain("min-width: 1024px")
      Arr.forEach(textSemantics, (semantics) => {
        const candidates = semanticTextCandidates(semantics)
        expect(candidates).toEqual(Arr.dedupe(candidates))
        Arr.forEach(candidates, (candidate) => expect(generated).toContain(candidate))
      })
    }).pipe(Effect.provide(BunContext.layer)))
})
