import { describe, expect, it } from "@effect/vitest"
import { BigDecimal, Chunk, Effect, Equal, FastCheck, Iterable, Number, Option } from "effect"

import { abs, ceil, floor, hypot, sqrt, toBigDecimal, toBigInt, truncate } from "../../src/Numeric/index.js"

const infinity = Number.unsafeDivide(1, 0)
const nan = Number.unsafeDivide(0, 0)

describe("Numeric binary64 arithmetic", () => {
  it.effect("retains fractional bits when converting to decimal for subsequent rounding", () =>
    Effect.gen(function*() {
      expect(Equal.equals(
        toBigDecimal(0.1),
        Option.some(
          BigDecimal.unsafeFromString("0.1000000000000000055511151231257827021181583404541015625")
        )
      )).toBe(true)
      expect(Equal.equals(
        Option.map(toBigDecimal(1.005), (value) => BigDecimal.round(value, { scale: 2 })),
        Option.some(BigDecimal.unsafeFromString("1.00"))
      )).toBe(true)
      expect(toBigDecimal(nan)).toEqual(Option.none())
      expect(toBigDecimal(infinity)).toEqual(Option.none())
    }))

  it.effect("converts the exact integer rather than its shortest decimal spelling", () =>
    Effect.gen(function*() {
      // The nearest binary64 value to 10^23 is 2^23 below that decimal integer.
      expect(toBigInt(1e23)).toEqual(Option.some(99_999_999_999_999_991_611_392n))
      expect(toBigInt(-1e23)).toEqual(Option.some(-99_999_999_999_999_991_611_392n))
      expect(toBigInt(-7)).toEqual(Option.some(-7n))
      expect(toBigInt(-0)).toEqual(Option.some(0n))
      expect(toBigInt(1.5)).toEqual(Option.none())
      expect(toBigInt(infinity)).toEqual(Option.none())
      expect(toBigInt(nan)).toEqual(Option.none())
    }))

  it.effect("rounds roots on both sides of a binary64 rounding boundary", () =>
    Effect.gen(function*() {
      // Squaring the midpoint between 1 and its successor places these inputs
      // on opposite sides. These expectations do not use the implementation.
      expect(sqrt(1.0000000000000002)).toBe(1)
      expect(sqrt(1.0000000000000004)).toBe(1.0000000000000002)
      expect(sqrt(2)).toBe(1.4142135623730951)
      expect(sqrt(5e-324)).toBe(2.2227587494850775e-162)
      expect(sqrt(1.7976931348623157e308)).toBe(1.3407807929942596e154)
    }))

  it.effect.prop("recovers exactly representable integer square roots", {
    root: FastCheck.integer({ min: 0, max: 1_000_000 })
  }, ({ root }) =>
    Effect.gen(function*() {
      expect(sqrt(Number.multiply(root, root))).toBe(root)
    }))

  it.effect("preserves signed zero and dispatches exceptional roots", () =>
    Effect.gen(function*() {
      expect(sqrt(-0)).toBe(-0)
      expect(sqrt(0)).toBe(0)
      expect(sqrt(infinity)).toBe(infinity)
      expect(sqrt(-1)).toBeNaN()
      expect(sqrt(Number.negate(infinity))).toBeNaN()
      expect(sqrt(nan)).toBeNaN()
      expect(abs(-0)).toBe(0)
      expect(abs(Number.negate(infinity))).toBe(infinity)
      expect(abs(nan)).toBeNaN()
    }))

  it.effect("computes norms without overflowing or underflowing the squares", () =>
    Effect.gen(function*() {
      // Powers of two preserve the exact Pythagorean relation in binary64;
      // decimal factors such as 1e200 do not preserve that relation.
      const large = Number.multiplyAll(Iterable.take(Iterable.makeBy(() => 2), 600))
      const small = Number.unsafeDivide(1, large)
      expect(hypot(Chunk.make(Number.multiply(3, large), Number.multiply(4, large)))).toBe(Number.multiply(5, large))
      expect(hypot(Chunk.make(Number.multiply(3, small), Number.multiply(4, small)))).toBe(Number.multiply(5, small))
      expect(hypot(Chunk.make(1.5e-323, 2e-323))).toBe(2.5e-323)
      expect(hypot(Chunk.make(2, 3, 6))).toBe(7)
      expect(hypot(Chunk.make(1.7976931348623157e308, 1.7976931348623157e308))).toBe(infinity)
    }))

  it.effect("prioritizes infinite norm components over NaN and canonicalizes zero", () =>
    Effect.gen(function*() {
      expect(hypot(Chunk.empty())).toBe(0)
      expect(hypot(Chunk.make(-0, -0))).toBe(0)
      expect(hypot(Chunk.make(nan, infinity))).toBe(infinity)
      expect(hypot(Chunk.make(Number.negate(infinity), nan))).toBe(infinity)
      expect(hypot(Chunk.make(3, nan))).toBeNaN()
    }))

  it.effect("accepts dense inputs beyond a function argument list's capacity", () =>
    Effect.gen(function*() {
      expect(hypot(Chunk.prepend(Chunk.makeBy(150_000, () => 0), 7))).toBe(7)
    }))

  it.effect("preserves the sign of zero through integer rounding", () =>
    Effect.gen(function*() {
      expect(floor(-0)).toBe(-0)
      expect(ceil(-0.25)).toBe(-0)
      expect(truncate(-0.25)).toBe(-0)
      expect(floor(-0.25)).toBe(-1)
      expect(ceil(0.25)).toBe(1)
      expect(truncate(0.25)).toBe(0)
    }))
})
