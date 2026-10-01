import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Number, Option, Schema } from "effect"

import { bisectValidated, goldenSectionValidated } from "../../src/Optimization.js"

describe("Optimization validation", () => {
  it.effect("accepts canonical valid bisect input", () =>
    Effect.gen(function*() {
      const result = yield* bisectValidated((x) => Number.subtract(Number.multiply(x, x), 2), { a: 0, b: 2 })
      expect(result).toBeCloseTo(1.41421, 4)
    }))

  it.effect("accepts canonical valid goldenSection input", () =>
    Effect.gen(function*() {
      const result = yield* goldenSectionValidated((x) => Number.multiply(x, x), { a: -2, b: 2 })
      expect(result).toBeCloseTo(0, 4)
    }))

  it.effect("rejects excess properties on bisect with typed decode error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        bisectValidated((x) => Number.subtract(Number.multiply(x, x), 2), { a: 0, b: 2, extra: true })
      )
      expect(Option.map(Either.getLeft(result), (error) => error._tag)).toStrictEqual(
        Option.some("OptimizationDecodeError")
      )
    }))

  it.effect("rejects excess properties on goldenSection with typed decode error", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(
        goldenSectionValidated((x) => Number.multiply(x, x), { a: -2, b: 2, extra: true })
      )
      expect(Option.map(Either.getLeft(result), (error) => error._tag)).toStrictEqual(
        Option.some("OptimizationDecodeError")
      )
    }))

  it.effect("rejects malformed input with wrong types", () =>
    Effect.gen(function*() {
      const result = yield* Effect.either(bisectValidated((x) => x, { a: "bad", b: 2 }))
      expect(result._tag).toBe("Left")
    }))

  it.effect("preserves the callback error message in a typed execution failure", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        bisectValidated(() => Schema.decodeUnknownSync(Schema.Number)("invalid"), { a: 0, b: 2 })
      )

      expect(error._tag).toBe("KernelExecutionError")
      expect(error.operation).toBe("bisect")
      expect(error.message).toBe("Expected number, actual \"invalid\"")
    }))
})
