import { describe, expect, it } from "@effect/vitest"
import { Array, Effect, Number, Tuple } from "effect"

import * as Numeric from "../../src/Numeric.js"
import { positiveInfinity } from "../helpers/nonFinite.js"

// Independent 100-digit Python Decimal references: Decimal.from_float(x) ** n
// for powers; Taylor sin/cos with pi = 16*atan(1/5) - 4*atan(1/239) for angles.
// Inputs are exact binary64 values, not the displayed decimal rationals.
const powers = Array.make(
  Tuple.make(1.0000000000000002, 9007199254740992, 7.389056098930649),
  Tuple.make(0.9999999999999999, 9007199254740992, 0.3678794411714423),
  Tuple.make(1.0000000000000002, -9007199254740992, 0.13533528323661273),
  Tuple.make(1.0000000000000002, 9007199254740991, 7.389056098930647),
  Tuple.make(-1.0000000000000002, 9007199254740991, -7.389056098930647),
  Tuple.make(1.0000001, 10000000, 2.7182816941320818),
  Tuple.make(0.9999999, -10000000, 2.7182819629423656),
  Tuple.make(1.5, 63, 124093581919.64894),
  Tuple.make(1.5, 64, 186140372879.47342),
  Tuple.make(1.5, 65, 279210559319.21014),
  Tuple.make(0.3, -3, 37.03703703703704),
  Tuple.make(1.0000000000000002, 3.196577161300664e18, 1.7976931348621315e308)
)

const angles = Array.make(
  Tuple.make(5e-324, 5e-324, 1),
  Tuple.make(9.313225746154785e-10, 9.313225746154785e-10, 1),
  Tuple.make(0.7853981633974482, 0.7071067811865475, 0.7071067811865476),
  Tuple.make(0.7853981633974483, 0.7071067811865475, 0.7071067811865476),
  Tuple.make(0.7853981633974484, 0.7071067811865476, 0.7071067811865475),
  Tuple.make(1.5707963267948963, 1, 2.83276944882399e-16),
  Tuple.make(1.5707963267948966, 1, 6.123233995736766e-17),
  Tuple.make(1.5707963267948968, 1, -1.6081226496766366e-16),
  Tuple.make(3.141592653589793, 1.2246467991473532e-16, -1),
  Tuple.make(4.71238898038469, -1, -1.8369701987210297e-16),
  Tuple.make(6.283185307179586, -2.4492935982947064e-16, 1),
  Tuple.make(17.3, -0.9997744310730111, 0.021238808173646012),
  Tuple.make(1570.7963267948965, -1.6070832296378168e-13, 1),
  Tuple.make(1048575.9999999999, 0.3304931399118609, 0.9438083939397864),
  Tuple.make(1048576, 0.3304931400217347, 0.943808393901312),
  Tuple.make(1048576.0000000002, 0.3304931402414822, 0.9438083938243631)
)

// Decimal.from_float(x).sqrt(), evaluated with 160 decimal digits. These
// straddle the subnormal/normal input boundary and a root binade boundary.
const roots = Array.make(
  Tuple.make(2.225073858507201e-308, 1.4916681462400412e-154),
  Tuple.make(2.2250738585072014e-308, 1.4916681462400413e-154),
  Tuple.make(2.225073858507202e-308, 1.4916681462400413e-154),
  Tuple.make(1e-300, 1e-150),
  Tuple.make(1e-10, 1e-5),
  Tuple.make(3.9999999999999996, 1.9999999999999998),
  Tuple.make(4, 2),
  Tuple.make(4.000000000000001, 2),
  Tuple.make(17.3, 4.159326868617084),
  Tuple.make(1e200, 1e100)
)

const fractionalPowers = Array.make(
  Tuple.make(0.000244140625, 1.15, 7.011098358136205e-5, 3e-15),
  Tuple.make(0.37, 1.35, 0.26125964205040103, 3e-15),
  Tuple.make(0.81, 2.2, 0.6290237473288554, 3e-15),
  Tuple.make(1.0000000000000002, 1.65, 1.0000000000000004, 3e-15),
  // log(base) is about -36.6: log/product rounding is amplified by exp.
  // The established binary64 composition has about 4.2e-15 relative error.
  Tuple.make(1.2246467991473532e-16, 1.15, 5.025884218126268e-19, 1e-14)
)

const close = (actual: number, expected: number) =>
  expect(Numeric.abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(
    Number.multiply(Numeric.abs(expected), 3e-16)
  )

describe("Numeric rounding-sensitive inputs", () => {
  it.effect("rounds scalar roots across normalization and binade boundaries", () =>
    Effect.gen(function*() {
      Array.forEach(roots, ([input, expected]) => expect(Numeric.sqrt(input)).toBe(expected))
    }))

  it.effect("retains fractional-power accuracy with exact binary64 bases and exponents", () =>
    Effect.gen(function*() {
      Array.forEach(fractionalPowers, ([base, exponent, expected, tolerance]) => {
        expect(Numeric.abs(Number.subtract(Numeric.pow(base, exponent), expected))).toBeLessThanOrEqual(
          Number.multiply(Numeric.abs(expected), tolerance)
        )
      })
    }))

  it.effect("retains near-unity residuals through large signed integer powers", () =>
    Effect.gen(function*() {
      Array.forEach(powers, ([base, exponent, expected]) => close(Numeric.pow(base, exponent), expected))
    }))

  it.effect("rounds large integer powers on either side of overflow and underflow", () =>
    Effect.gen(function*() {
      // Adjacent binary64 exponents straddle each boundary; a rounded
      // binary64 log/product can move the result across it.
      expect(Numeric.pow(1.0000000000000002, 3.1965771613006643e18)).toBe(positiveInfinity)
      expect(Numeric.pow(1.0000000000000002, -3.355781687888881e18)).toBe(0)
      expect(Numeric.pow(1.0000000000000002, -3.3557816878888806e18)).toBe(5e-324)
      expect(Numeric.pow(-1, 9007199254740991)).toBe(-1)
      expect(Numeric.pow(-1, 9007199254740992)).toBe(1)
    }))

  it.effect("retains quadrant residuals across both argument-reduction boundaries", () =>
    Effect.gen(function*() {
      Array.forEach(angles, ([angle, sine, cosine]) => {
        close(Numeric.sin(angle), sine)
        close(Numeric.cos(angle), cosine)
        close(Numeric.sin(Number.multiply(-1, angle)), Number.multiply(-1, sine))
        close(Numeric.cos(Number.multiply(-1, angle)), cosine)
      })
    }))
})
