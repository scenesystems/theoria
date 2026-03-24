import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { dotValidated, normValidated, transposeValidated } from "../../src/LinearAlgebra/operations.js"

describe("LinearAlgebra runtime boundary contracts", () => {
  it.effect("accepts canonical valid dot product input", () =>
    Effect.gen(function*() {
      const result = yield* dotValidated({ a: [1, 2, 3], b: [4, 5, 6] })
      expect(result).toBe(32)
    }))

  it.effect("accepts canonical valid norm input", () =>
    Effect.gen(function*() {
      const result = yield* normValidated({ values: [3, 4], kind: "L2" })
      expect(result).toBe(5)
    }))

  it.effect("accepts canonical valid transpose input", () =>
    Effect.gen(function*() {
      const result = yield* transposeValidated({ data: [1, 2, 3, 4], rows: 2, cols: 2 })
      expect(result).toStrictEqual([1, 3, 2, 4])
    }))

  it.effect("rejects excess properties on dot product with typed decode error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(dotValidated({ a: [1, 2, 3], b: [4, 5, 6], extra: true }))
      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("LinearAlgebraDecodeError")
      }
    }))

  it.effect("rejects excess properties on norm with typed decode error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(normValidated({ values: [3, 4], kind: "L2", extra: true }))
      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("LinearAlgebraDecodeError")
      }
    }))

  it.effect("rejects malformed input with wrong types", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(dotValidated({ a: "not-an-array", b: [1, 2] }))
      expect(result._tag).toBe("Left")
    }))
})
