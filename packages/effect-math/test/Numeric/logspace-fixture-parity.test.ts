import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Match, Number as N, Schema } from "effect"

import { log1mexp, log1pexp, logaddexp, logsubexp, logSumExp, xlog1py, xlogy } from "../../src/Numeric/operations.js"
import { FixtureRegistryLive, loadFixture, NumericLogspaceParityFixtureSchema } from "../helpers/fixtures/index.js"

const RELATIVE_TOLERANCE = 1e-12
const ABSOLUTE_TOLERANCE = 1e-12

const expectParity = (actual: number, expected: number, absoluteTol: number = ABSOLUTE_TOLERANCE) => {
  const absExpected = Math.abs(expected)
  const tolerance = absExpected > 1 ? N.multiply(absExpected, RELATIVE_TOLERANCE) : absoluteTol
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

describe("Numeric logspace SciPy fixture parity", () => {
  it.effect("all logspace-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("numeric.logspace-parity")
      const fixture = yield* Schema.decodeUnknown(NumericLogspaceParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Arr.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "logaddexp" }, (v) => expectParity(logaddexp(v.input.a, v.input.b), v.expected)),
            Match.when({ operation: "logsubexp" }, (v) => expectParity(logsubexp(v.input.a, v.input.b), v.expected)),
            Match.when({ operation: "log1mexp" }, (v) => expectParity(log1mexp(v.input.x), v.expected)),
            Match.when({ operation: "log1pexp" }, (v) => expectParity(log1pexp(v.input.x), v.expected)),
            Match.when({ operation: "xlogy" }, (v) => expectParity(xlogy(v.input.x, v.input.y), v.expected)),
            Match.when({ operation: "xlog1py" }, (v) => expectParity(xlog1py(v.input.x, v.input.y), v.expected)),
            Match.when({ operation: "logSumExp" }, (v) =>
              expectParity(logSumExp(Chunk.fromIterable(v.input.values)), v.expected)),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
