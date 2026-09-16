import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

import { Axis, Dimension } from "../../src/LinearAlgebra.js"

describe("LinearAlgebra shape scalars", () => {
  it.effect("decodes positive dimensions and zero-based axes", () =>
    Effect.gen(function*() {
      expect(yield* Schema.decodeUnknown(Dimension)(3)).toBe(3)
      expect(yield* Schema.decodeUnknown(Axis)(0)).toBe(0)
      expect(yield* Schema.decodeUnknown(Axis)(2)).toBe(2)
    }))

  it.effect("rejects empty dimensions and invalid axes", () =>
    Effect.gen(function*() {
      expect(Option.isNone(yield* Effect.option(Schema.decodeUnknown(Dimension)(0)))).toBe(true)
      expect(Option.isNone(yield* Effect.option(Schema.decodeUnknown(Axis)(-1)))).toBe(true)
      expect(Option.isNone(yield* Effect.option(Schema.decodeUnknown(Axis)(1.5)))).toBe(true)
    }))
})
