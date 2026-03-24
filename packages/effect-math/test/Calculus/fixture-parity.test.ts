import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Match, Number as N, Schema } from "effect"

import { derivative, simpson, trapezoid } from "../../src/Calculus/operations.js"
import { CalculusNumericalParityFixtureSchema, FixtureRegistryLive, loadFixture } from "../helpers/fixtures/index.js"

const RELATIVE_TOLERANCE = 1e-6
const ABSOLUTE_TOLERANCE = 1e-12

const testFunctions: Record<string, (x: number) => number> = {
  x_squared: (x) => N.multiply(x, x),
  x_cubed: (x) => N.multiply(N.multiply(x, x), x),
  sin: Math.sin,
  exp: Math.exp,
  ln: Math.log
}

const expectParity = (actual: number, expected: number, absoluteTol: number = ABSOLUTE_TOLERANCE) => {
  const absExpected = Math.abs(expected)
  const tolerance = absExpected > 1 ? N.multiply(absExpected, RELATIVE_TOLERANCE) : absoluteTol
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

describe("Calculus SciPy fixture parity", () => {
  it.effect("all numerical-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("calculus.numerical-parity")
      const fixture = yield* Schema.decodeUnknown(CalculusNumericalParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Arr.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "derivative" }, (v) => {
              const fn = testFunctions[v.input.function]!
              expectParity(derivative(fn, v.input.x), v.expected, RELATIVE_TOLERANCE)
            }),
            Match.when({ operation: "trapezoid" }, (v) =>
              expectParity(trapezoid(Chunk.fromIterable(v.input.values), v.input.dx), v.expected)),
            Match.when({ operation: "simpson" }, (v) =>
              expectParity(simpson(Chunk.fromIterable(v.input.values), v.input.dx), v.expected)),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
