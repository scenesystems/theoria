import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, Equal } from "effect"

import { distanceValidated, midpointValidated } from "../../src/Geometry.js"

describe("Geometry runtime boundary contracts", () => {
  it.effect("accepts canonical distance and midpoint inputs", () =>
    Effect.gen(function*() {
      expect(yield* distanceValidated({ a: Array.make(0, 0), b: Array.make(3, 4), metric: "euclidean" })).toBe(5)
      const midpoint = yield* midpointValidated({ a: Array.make(0, 0), b: Array.make(4, 6) })
      expect(Equal.equals(midpoint, Chunk.make(2, 3))).toBe(true)
    }))

  it.effect("reports excess midpoint fields as typed decode failures", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(midpointValidated({ a: Array.make(0, 0), b: Array.make(4, 6), extra: true }))
      expect(error._tag).toBe("GeometryDecodeError")
      expect(error.operation).toBe("midpoint")
    }))

  it.effect("reports incompatible point dimensions as typed shape failures", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        distanceValidated({ a: Array.make(1, 2, 3), b: Array.make(1, 2), metric: "manhattan" })
      )
      expect(error._tag).toBe("GeometryShapeMismatchError")
    }))
})
