import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, Equal } from "effect"

import { dotValidated, normValidated, transposeValidated } from "../../src/LinearAlgebra.js"

describe("LinearAlgebra runtime boundary contracts", () => {
  it.effect("accepts canonical dot, norm, and transpose inputs", () =>
    Effect.gen(function*() {
      expect(yield* dotValidated({ a: Array.make(1, 2, 3), b: Array.make(4, 5, 6) })).toBe(32)
      expect(yield* normValidated({ values: Array.make(3, 4), kind: "L2" })).toBe(5)
      const transposed = yield* transposeValidated({ data: Array.make(1, 2, 3, 4), rows: 2, cols: 2 })
      expect(Equal.equals(transposed, Chunk.make(1, 3, 2, 4))).toBe(true)
    }))

  it.effect("reports excess dot fields as typed decode failures", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        dotValidated({ a: Array.make(1, 2, 3), b: Array.make(4, 5, 6), extra: true })
      )
      expect(error._tag).toBe("LinearAlgebraDecodeError")
      expect(error.operation).toBe("dot")
    }))

  it.effect("reports incompatible dot dimensions as typed shape failures", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(dotValidated({ a: Array.make(1, 2, 3), b: Array.make(4, 5) }))
      expect(error._tag).toBe("ShapeMismatchError")
    }))
})
