import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, Match, Number, Schema } from "effect"

import { normalCdf, normalPdf, uniformCdf, uniformPdf } from "../../src/Distribution.js"
import { abs } from "../../src/Numeric.js"
import { entropy } from "../../src/Probability.js"
import { loadFixture, ProbabilityDistributionParityFixtureSchema } from "../helpers/fixtures/index.js"

const normalPdfTolerance = 1e-14
const normalCdfTolerance = 2e-14
const uniformTolerance = 1e-14
const entropyTolerance = 1e-12

const expectWithinTolerance = (actual: number, expected: number, tolerance: number) =>
  expect(abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

describe("Probability SciPy fixture parity", () => {
  it.effect("all distribution-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("probability.distribution-parity")
      const fixture = yield* Schema.decodeUnknown(ProbabilityDistributionParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Array.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "normalPdf" }, (v) =>
              expectWithinTolerance(normalPdf(v.input.x, v.input.mu, v.input.sigma), v.expected, normalPdfTolerance)),
            Match.when({ operation: "normalCdf" }, (v) =>
              expectWithinTolerance(normalCdf(v.input.x, v.input.mu, v.input.sigma), v.expected, normalCdfTolerance)),
            Match.when({ operation: "uniformPdf" }, (v) =>
              expectWithinTolerance(
                uniformPdf(v.input.x, v.input.low, v.input.high),
                v.expected,
                uniformTolerance
              )),
            Match.when({ operation: "uniformCdf" }, (v) =>
              expectWithinTolerance(
                uniformCdf(v.input.x, v.input.low, v.input.high),
                v.expected,
                uniformTolerance
              )),
            Match.when({ operation: "entropy" }, (v) =>
              expectWithinTolerance(
                entropy(Chunk.fromIterable(v.input.probabilities)),
                v.expected,
                entropyTolerance
              )),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(BunContext.layer)))
})
