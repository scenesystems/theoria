import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Match, Number as N, Schema } from "effect"

import { abs } from "../../src/Numeric/operations.js"
import { findRoot } from "../../src/Optimization/operations.js"
import {
  FixtureRegistryLive,
  loadFixture,
  OptimizationRootFindingParityFixtureSchema
} from "../helpers/fixtures/index.js"

const rootFunctions: Record<string, (x: number) => number> = {
  x_squared_minus_2: (x) => N.subtract(N.multiply(x, x), 2),
  cos: Math.cos,
  exp_minus_2: (x) => N.subtract(Math.exp(x), 2),
  linear_2x_minus_3: (x) => N.subtract(N.multiply(2, x), 3)
}

const derivativeFunctions: Record<string, (x: number) => number> = {
  dx_squared_minus_2: (x) => N.multiply(2, x),
  dcos: (x) => N.negate(Math.sin(x)),
  dexp_minus_2: Math.exp
}

describe("Optimization / root-finding fixture parity", () => {
  it.effect("matches SciPy Brent, secant, and Newton-Raphson roots within the committed residual envelope", () =>
    Effect.gen(function*() {
      const fixture = yield* loadFixture("optimization.root-finding-parity").pipe(
        Effect.flatMap((raw) =>
          Schema.decodeUnknown(OptimizationRootFindingParityFixtureSchema)(raw, {
            onExcessProperty: "error"
          })
        )
      )

      yield* Effect.forEach(
        Arr.fromIterable(fixture.payload.cases),
        (rootCase) =>
          Effect.sync(() =>
            Match.value(rootCase).pipe(
              Match.when({ operation: "brent" }, (value) => {
                const result = findRoot(rootFunctions[value.input.function]!, {
                  method: "brent",
                  lowerBound: value.input.lowerBound,
                  upperBound: value.input.upperBound
                })

                expect(result.status).toBe("converged")
                expect(abs(N.subtract(result.root, value.expected.root))).toBeLessThanOrEqual(
                  value.expected.rootTolerance
                )
                expect(result.residual).toBeLessThanOrEqual(value.expected.residualTolerance)
              }),
              Match.when({ operation: "secant" }, (value) => {
                const result = findRoot(rootFunctions[value.input.function]!, {
                  method: "secant",
                  previousEstimate: value.input.previousEstimate,
                  currentEstimate: value.input.currentEstimate
                })

                expect(result.status).toBe("converged")
                expect(abs(N.subtract(result.root, value.expected.root))).toBeLessThanOrEqual(
                  value.expected.rootTolerance
                )
                expect(result.residual).toBeLessThanOrEqual(value.expected.residualTolerance)
              }),
              Match.when({ operation: "newtonRaphson" }, (value) => {
                const result = findRoot(
                  rootFunctions[value.input.function]!,
                  {
                    method: "newtonRaphson",
                    initialGuess: value.input.initialGuess
                  },
                  {
                    derivative: derivativeFunctions[value.input.derivative]!
                  }
                )

                expect(result.status).toBe("converged")
                expect(abs(N.subtract(result.root, value.expected.root))).toBeLessThanOrEqual(
                  value.expected.rootTolerance
                )
                expect(result.residual).toBeLessThanOrEqual(value.expected.residualTolerance)
              }),
              Match.exhaustive
            )
          ),
        { discard: true }
      )
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
