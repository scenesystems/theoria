import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as N } from "effect"

import {
  acos,
  acosh,
  asin,
  asinh,
  atan,
  atan2,
  atanh,
  ceil,
  cos,
  cosh,
  degreesToRadians,
  floor,
  hypot,
  imul,
  radiansToDegrees,
  round,
  sin,
  sinh,
  tan,
  tanh,
  TAU,
  trunc
} from "../../src/Numeric/operations.js"

const TOLERANCE = 1e-12

const expectClose = (actual: number, expected: number, tolerance = TOLERANCE) =>
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

describe("Numeric scalar operations", () => {
  it.effect("round-trips canonical angles and keeps TAU stable", () =>
    Effect.gen(function*() {
      expectClose(TAU, Math.PI * 2)
      expectClose(degreesToRadians(180), Math.PI)
      expectClose(radiansToDegrees(Math.PI / 2), 90)
      expectClose(radiansToDegrees(degreesToRadians(270)), 270)
    }))

  it.effect("keeps atan2 quadrant-sensitive and hypot Euclidean", () =>
    Effect.gen(function*() {
      expectClose(atan2(1, 1), Math.PI / 4)
      expectClose(atan2(1, -1), 3 * Math.PI / 4)
      expectClose(atan2(-1, -1), -3 * Math.PI / 4)
      expectClose(hypot(3, 4), 5)
    }))

  it.effect("satisfies circular and hyperbolic identities on canonical fixtures", () =>
    Effect.gen(function*() {
      const angle = 0.7
      const hyperbolicPoint = 1.25

      expectClose(sin(angle) ** 2 + cos(angle) ** 2, 1)
      expectClose(tan(angle), sin(angle) / cos(angle))
      expectClose(cosh(hyperbolicPoint) ** 2 - sinh(hyperbolicPoint) ** 2, 1)
      expectClose(tanh(hyperbolicPoint), sinh(hyperbolicPoint) / cosh(hyperbolicPoint))
    }))

  it.effect("keeps inverse-function spot checks stable inside the principal domains", () =>
    Effect.gen(function*() {
      expectClose(asin(sin(0.5)), 0.5)
      expectClose(acos(cos(0.5)), 0.5)
      expectClose(atan(tan(0.5)), 0.5)
      expectClose(asinh(sinh(0.5)), 0.5)
      expectClose(acosh(cosh(1.5)), 1.5)
      expectClose(atanh(tanh(0.5)), 0.5)
    }))

  it.effect("matches IEEE-754 rounding semantics and deterministic int32 multiplication", () =>
    Effect.gen(function*() {
      expect(floor(-1.2)).toStrictEqual(-2)
      expect(ceil(-1.2)).toStrictEqual(-1)
      expect(round(-1.5)).toStrictEqual(-1)
      expect(round(1.5)).toStrictEqual(2)
      expect(trunc(-1.9)).toStrictEqual(-1)
      expect(imul(0x7fffffff, 2)).toStrictEqual(-2)
      expect(imul(-1, 8)).toStrictEqual(-8)
    }))
})
