/** Private ML-DSA-65 canonical-hint encoding law. */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number as N, Schema } from "effect"
import { hasInvalidMlDsa65HintEncoding } from "../../src/internal/mlDsa65.js"

describe("ML-DSA-65 hint encoding", () => {
  it.effect("admits empty segments and rejects endpoint, ordering, padding, and truncation errors", () => {
    const canonical = Arr.appendAll(
      Arr.appendAll(Arr.appendAll(Arr.replicate(0, 3_248), Arr.make(4, 9, 4)), Arr.replicate(0, 52)),
      Arr.make(2, 2, 3, 3, 3, 3)
    )
    const full = Arr.appendAll(
      Arr.appendAll(Arr.replicate(0, 3_248), Arr.range(0, 54)),
      Arr.replicate(55, 6)
    )
    return Effect.gen(function*() {
      yield* Effect.forEach(Arr.make(Arr.replicate(0, 3_309), canonical, full), (bytes) =>
        Effect.gen(function*() {
          expect(hasInvalidMlDsa65HintEncoding(yield* Schema.decode(Schema.Uint8Array)(bytes))).toBe(false)
        }))
      yield* Effect.forEach(
        Arr.make(
          Arr.replace(canonical, 3_303, 56),
          Arr.replace(canonical, 3_304, 1),
          Arr.replace(canonical, 3_249, 4),
          Arr.replace(canonical, 3_249, 3),
          Arr.replace(canonical, 3_251, 1)
        ),
        (bytes) =>
          Effect.gen(function*() {
            expect(hasInvalidMlDsa65HintEncoding(yield* Schema.decode(Schema.Uint8Array)(bytes))).toBe(true)
          })
      )
      yield* Effect.forEach(Arr.range(0, 5), (present) =>
        Effect.gen(function*() {
          const bytes = yield* Schema.decode(Schema.Uint8Array)(Arr.replicate(0, N.sum(3_303, present)))
          expect(hasInvalidMlDsa65HintEncoding(bytes)).toBe(true)
        }))
    })
  })
})
