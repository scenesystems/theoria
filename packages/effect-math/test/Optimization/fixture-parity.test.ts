import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as N, Schema } from "effect"

import { bisect, goldenSection } from "../../src/Optimization/operations.js"
import { FixtureRegistryLive, loadFixture, OptimizationSolverParityFixtureSchema } from "../helpers/fixtures/index.js"

const ABSOLUTE_TOLERANCE = 1e-6

const expectParity = (actual: number, expected: number) => {
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(ABSOLUTE_TOLERANCE)
}

const rootFunctions: Record<string, (x: number) => number> = {
  x_squared_minus_2: (x) => N.subtract(N.multiply(x, x), 2),
  cos: Math.cos,
  x_cubed_minus_1: (x) => N.subtract(N.multiply(N.multiply(x, x), x), 1),
  sin: Math.sin,
  exp_minus_2: (x) => N.subtract(Math.exp(x), 2),
  linear_2x_minus_3: (x) => N.subtract(N.multiply(2, x), 3)
}

const minimizeFunctions: Record<string, (x: number) => number> = {
  x_squared: (x) => N.multiply(x, x),
  x_minus_1_squared: (x) => N.multiply(N.subtract(x, 1), N.subtract(x, 1)),
  x4_minus_x2: (x) => N.subtract(N.multiply(N.multiply(x, x), N.multiply(x, x)), N.multiply(x, x)),
  cos: Math.cos,
  abs_x: Math.abs
}

describe("Optimization SciPy fixture parity", () => {
  it.effect("all solver-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const fixture = yield* loadFixture("optimization.solver-parity").pipe(
        Effect.flatMap((raw) =>
          Schema.decodeUnknown(OptimizationSolverParityFixtureSchema)(raw, {
            onExcessProperty: "error"
          })
        )
      )

      yield* Effect.forEach(Arr.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "bisect" }, (v) => {
              const fn = rootFunctions[v.input.function]!
              expectParity(bisect(fn, v.input.a, v.input.b), v.expected)
            }),
            Match.when({ operation: "goldenSection" }, (v) => {
              const fn = minimizeFunctions[v.input.function]!
              expectParity(goldenSection(fn, v.input.a, v.input.b), v.expected)
            }),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
