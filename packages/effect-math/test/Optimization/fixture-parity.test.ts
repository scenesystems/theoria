import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array, Data, Effect, Match, Number, Option, Record, Schema } from "effect"

import * as Numeric from "../../src/Numeric.js"
import { bisect, goldenSection } from "../../src/Optimization.js"
import { loadFixture, OptimizationSolverParityFixtureSchema } from "../helpers/fixtures/index.js"

const absoluteTolerance = 1e-6

const expectParity = (actual: number, expected: number) => {
  expect(Numeric.abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(absoluteTolerance)
}

class UnknownFixtureFunction extends Data.TaggedError("UnknownFixtureFunction")<{ readonly name: string }> {}

const lookup = <F>(
  registry: Record.ReadonlyRecord<string, F>,
  name: string
): Effect.Effect<F, UnknownFixtureFunction> =>
  Option.match(Record.get(registry, name), {
    onNone: () => Effect.fail(new UnknownFixtureFunction({ name })),
    onSome: Effect.succeed
  })

const rootFunctions: Record.ReadonlyRecord<string, (x: number) => number> = {
  x_squared_minus_2: (x) => Number.subtract(Number.multiply(x, x), 2),
  cos: Numeric.cos,
  x_cubed_minus_1: (x) => Number.subtract(Number.multiply(Number.multiply(x, x), x), 1),
  sin: Numeric.sin,
  exp_minus_2: (x) => Number.subtract(Numeric.exp(x), 2),
  linear_2x_minus_3: (x) => Number.subtract(Number.multiply(2, x), 3)
}

const minimizeFunctions: Record.ReadonlyRecord<string, (x: number) => number> = {
  x_squared: (x) => Number.multiply(x, x),
  x_minus_1_squared: (x) => Number.multiply(Number.subtract(x, 1), Number.subtract(x, 1)),
  x4_minus_x2: (x) =>
    Number.subtract(Number.multiply(Number.multiply(x, x), Number.multiply(x, x)), Number.multiply(x, x)),
  cos: Numeric.cos,
  abs_x: Numeric.abs
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

      yield* Effect.forEach(Array.fromIterable(fixture.payload.cases), (c) =>
        Match.value(c).pipe(
          Match.when({ operation: "bisect" }, (v) =>
            Effect.map(
              lookup(rootFunctions, v.input.function),
              (fn) => expectParity(bisect(fn, v.input.a, v.input.b), v.expected)
            )),
          Match.when(
            { operation: "goldenSection" },
            (v) =>
              Effect.map(
                lookup(minimizeFunctions, v.input.function),
                (fn) => expectParity(goldenSection(fn, v.input.a, v.input.b), v.expected)
              )
          ),
          Match.exhaustive
        ))
    }).pipe(Effect.provide(BunContext.layer)))
})
