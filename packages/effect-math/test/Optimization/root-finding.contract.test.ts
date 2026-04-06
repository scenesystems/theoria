import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as N, Schema } from "effect"

import { abs } from "../../src/Numeric/operations.js"
import { brent, findRoot, newtonRaphson, secant } from "../../src/Optimization/operations.js"
import { RootFindingResult } from "../../src/Optimization/schema.js"

const expectEnvelope = (options: {
  readonly actual: unknown
  readonly method: "brent" | "secant" | "newtonRaphson"
  readonly expectedRoot: number
  readonly tolerance: number
}) => {
  const decoded = Schema.decodeUnknownSync(RootFindingResult)(options.actual)

  expect(decoded.method).toBe(options.method)
  expect(decoded.status).toBe("converged")
  expect(abs(N.subtract(decoded.root, options.expectedRoot))).toBeLessThanOrEqual(options.tolerance)
  expect(decoded.iterationCount).toBeGreaterThanOrEqual(0)
  expect(decoded.functionEvaluationCount).toBeGreaterThan(0)
}

describe("Optimization / root finding envelope", () => {
  it.effect("Brent convenience helper carries the canonical result envelope", () =>
    Effect.sync(() =>
      expectEnvelope({
        actual: brent((x) => N.subtract(N.multiply(x, x), 2), 0, 2),
        method: "brent",
        expectedRoot: Math.sqrt(2),
        tolerance: 1e-8
      })
    ))

  it.effect("secant convenience helper carries the canonical result envelope", () =>
    Effect.sync(() =>
      expectEnvelope({
        actual: secant(Math.cos, 1, 2),
        method: "secant",
        expectedRoot: N.multiply(Math.PI, 0.5),
        tolerance: 1e-8
      })
    ))

  it.effect("Newton-Raphson convenience helper carries the canonical result envelope", () =>
    Effect.sync(() =>
      expectEnvelope({
        actual: newtonRaphson(
          (x) => N.subtract(N.multiply(x, x), 2),
          1.5,
          { derivative: (x) => N.multiply(2, x) }
        ),
        method: "newtonRaphson",
        expectedRoot: Math.sqrt(2),
        tolerance: 1e-10
      })
    ))

  it.effect("findRoot keeps the canonical method-union envelope available", () =>
    Effect.sync(() =>
      expectEnvelope({
        actual: findRoot((x) => N.subtract(N.multiply(x, x), 2), {
          method: "brent",
          lowerBound: 0,
          upperBound: 2
        }),
        method: "brent",
        expectedRoot: Math.sqrt(2),
        tolerance: 1e-8
      })
    ))
})
