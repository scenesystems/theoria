import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Match, Schema } from "effect"

import { factorial, gcd, lcm, polyDerivative, polyEval } from "../../src/Algebra/operations.js"
import { AlgebraPolynomialParityFixtureSchema, FixtureRegistryLive, loadFixture } from "../helpers/fixtures/index.js"

describe("Algebra SciPy fixture parity", () => {
  it.effect("all polynomial-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("algebra.polynomial-parity")
      const fixture = yield* Schema.decodeUnknown(AlgebraPolynomialParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Arr.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "polyEval" }, (v) => {
              const result = polyEval(Chunk.fromIterable(v.input.coefficients), v.input.x)
              expect(result).toStrictEqual(v.expected)
            }),
            Match.when({ operation: "polyDerivative" }, (v) => {
              const result = polyDerivative(Chunk.fromIterable(v.input.coefficients))
              expect(Chunk.toReadonlyArray(result)).toStrictEqual(v.expected)
            }),
            Match.when({ operation: "gcd" }, (v) => {
              expect(gcd(v.input.a, v.input.b)).toStrictEqual(v.expected)
            }),
            Match.when({ operation: "lcm" }, (v) => {
              expect(lcm(v.input.a, v.input.b)).toStrictEqual(v.expected)
            }),
            Match.when({ operation: "factorial" }, (v) => {
              expect(factorial(v.input.n)).toStrictEqual(v.expected)
            }),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
