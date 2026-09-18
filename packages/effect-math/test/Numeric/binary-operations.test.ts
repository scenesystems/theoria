import { describe, expect, it } from "@effect/vitest"
import { Array, BigDecimal, Boolean, Chunk, Effect, Equal, FastCheck, Iterable, Number, Option } from "effect"

import { abs, ceil, floor, hypot, sqrt, toBigDecimal, toBigInt, truncate } from "../../src/Numeric.js"

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

  it.effect("round-trips both neighbors of every normal power of two through exact decimals", () =>
    Effect.gen(function*() {
      const powers = Array.scan(Array.range(1, 2045), 2.2250738585072014e-308, (value) => Number.multiply(value, 2))
      Array.forEach(powers, (power) =>
        Array.forEach(
          Array.make(
            Number.subtract(power, Number.max(5e-324, Number.multiply(power, 1.1102230246251565e-16))),
            power,
            Number.sum(power, Number.multiply(power, 2.220446049250313e-16))
          ),
          (value) => expect(BigDecimal.unsafeToNumber(Option.getOrThrow(toBigDecimal(value)))).toBe(value)
        ))
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
      expect(sqrt(3.9999999999999996)).toBe(1.9999999999999998)
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

  it.effect.prop("retains midpoint rounding on both sides across binary exponents", {
    exponent: FastCheck.integer({ min: -500, max: 500 }),
    above: FastCheck.boolean()
  }, ({ exponent, above }) =>
    Effect.gen(function*() {
      const factor = Boolean.match(Number.lessThan(exponent, 0), { onTrue: () => 0.5, onFalse: () => 2 })
      const scale = Number.multiplyAll(Iterable.take(Iterable.makeBy(() => factor), abs(exponent)))
      const input = Boolean.match(above, { onTrue: () => 1.0000000000000004, onFalse: () => 1.0000000000000002 })
      const root = Boolean.match(above, { onTrue: () => 1.0000000000000002, onFalse: () => 1 })
      expect(sqrt(Number.multiply(Number.multiply(input, scale), scale))).toBe(Number.multiply(root, scale))
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
      // Python Decimal at precision 200, initialized from the exact binary64
      // operands, places the exact root below the midpoint to the successor.
      expect(hypot(Chunk.make(5_464.208024978638, 5_104.779699210003))).toBe(7_477.7232576304605)
    }))

  it.effect.prop("rounds vector midpoints to even without dropping decisive small squares", {
    exponent: FastCheck.integer({ min: -900, max: 900 }),
    reverse: FastCheck.boolean()
  }, ({ exponent, reverse }) =>
    Effect.gen(function*() {
      const factor = Boolean.match(Number.lessThan(exponent, 0), { onTrue: () => 0.5, onFalse: () => 2 })
      const scale = Number.multiplyAll(Iterable.take(Iterable.makeBy(() => factor), abs(exponent)))
      const norm = (values: Chunk.Chunk<number>) =>
        hypot(Chunk.map(
          Boolean.match(reverse, {
            onTrue: () => Chunk.reverse(values),
            onFalse: () => values
          }),
          (value) => Number.multiply(value, scale)
        ))
      // (1 + 2^-53)^2 = 1 + 2^-52 + 2^-106: an exact tie to even 1.
      const lowerTie = Chunk.make(1, 1.4901161193847656e-8, 1.1102230246251565e-16)
      expect(norm(lowerTie)).toBe(scale)
      expect(norm(Chunk.append(lowerTie, 5.551115123125783e-17))).toBe(Number.multiply(1.0000000000000002, scale))
      // (1 + 3*2^-53)^2: the lower neighbor is odd, so this tie rounds up.
      const upperTie = Chunk.make(1, 1.4901161193847656e-8, 1.4901161193847656e-8, 1.4901161193847656e-8)
      expect(norm(Chunk.append(upperTie, 3.3306690738754696e-16))).toBe(Number.multiply(1.0000000000000004, scale))
      expect(norm(Chunk.append(upperTie, 3.330669073875469e-16))).toBe(Number.multiply(1.0000000000000002, scale))
    }))

  it.effect("retains rounding across vector lengths and exponent ranges", () =>
    Effect.gen(function*() {
      // Python Decimal, precision 800, initialized from exact binary64 inputs.
      expect(hypot(Chunk.make(0.1, 0.3, 1.7, -12.9, 2.1))).toBe(13.183702059740277)
      expect(hypot(Chunk.make(1.7976931348623155e308, 1e300))).toBe(1.7976931348623155e308)
      expect(hypot(Chunk.make(2.2250738585072014e-308, 1e-310))).toBe(2.2250963295579194e-308)
      // 2^16 copies of (2^-8)^2 sum to exactly one, in either order.
      const smallSquares = Chunk.makeBy(65_536, () => 0.00390625)
      expect(hypot(smallSquares)).toBe(1)
      expect(hypot(Chunk.prepend(smallSquares, 1))).toBe(1.4142135623730951)
      expect(hypot(Chunk.append(smallSquares, 1))).toBe(1.4142135623730951)
      const shorter = Chunk.makeBy(16_384, () => 0.0078125)
      expect(hypot(Chunk.prepend(shorter, 1))).toBe(1.4142135623730951)
      expect(hypot(Chunk.append(shorter, 1))).toBe(1.4142135623730951)
      expect(hypot(Chunk.make(1, 1e-200))).toBe(1)
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
      expect(floor(4_503_599_627_370_495.5)).toBe(4_503_599_627_370_495)
      expect(ceil(4_503_599_627_370_495.5)).toBe(4_503_599_627_370_496)
      expect(truncate(-4_503_599_627_370_495.5)).toBe(-4_503_599_627_370_495)
      expect(floor(infinity)).toBe(infinity)
      expect(ceil(Number.negate(infinity))).toBe(Number.negate(infinity))
      expect(truncate(nan)).toBeNaN()
    }))
})
