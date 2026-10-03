/**
 * Schema encode/decode round-trip invariants for Module.SavedState.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Module from "@scenesystems/effect-dsp/Module"
import { Arbitrary, Effect, Schema } from "effect"

describe("Module.SavedState schema round-trip", () => {
  it.effect("preserves value identity through encode/decode", () =>
    Effect.gen(function*() {
      const result = yield* Arbitrary.checkEffect(
        Arbitrary.schema(Module.SavedState),
        (state) =>
          Effect.gen(function*() {
            const encoded = yield* Schema.encodeEffect(Module.SavedState)(state)
            const decoded = yield* Schema.decodeEffect(Module.SavedState)(encoded)
            return Schema.toEquivalence(Module.SavedState)(decoded, state)
          }),
        { runs: 75, size: 4 }
      )

      expect(Arbitrary.formatCheckFailure(result)).toBeUndefined()
    }))
})
