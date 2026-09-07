import { FileSystem } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import { textSemantics } from "../../app/contracts/text.js"
import { renderTextTokensCss, semanticTextCandidates } from "../../app/web/text/textTokens.js"

describe("Generated text tokens", () => {
  it.effect("matches the typography authority and covers every semantic candidate", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const generated = yield* fileSystem.readFileString("app/web/text-tokens.generated.css")
      const styles = yield* fileSystem.readFileString("app/web/styles.css")

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
