import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { distanceValidated, midpointValidated } from "../../src/Geometry/operations.js"

describe("Geometry runtime boundary contracts", () => {
  it.effect("accepts canonical valid distance input", () =>
    Effect.gen(function*() {
      const result = yield* distanceValidated({ a: [0, 0], b: [3, 4], metric: "euclidean" })
      expect(result).toBe(5)
    }))

  it.effect("accepts canonical valid midpoint input", () =>
    Effect.gen(function*() {
      const result = yield* midpointValidated({ a: [0, 0], b: [4, 6] })
      expect(result).toStrictEqual([2, 3])
    }))

  it.effect("rejects excess properties on distance with typed decode error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        distanceValidated({ a: [0, 0], b: [3, 4], metric: "euclidean", extra: true })
      )
      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("GeometryDecodeError")
      }
    }))

  it.effect("rejects excess properties on midpoint with typed decode error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(midpointValidated({ a: [0, 0], b: [4, 6], extra: true }))
      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("GeometryDecodeError")
      }
    }))

  it.effect("rejects malformed input with wrong types", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(distanceValidated({ a: "bad", b: [3, 4], metric: "euclidean" }))
      expect(result._tag).toBe("Left")
    }))
})
