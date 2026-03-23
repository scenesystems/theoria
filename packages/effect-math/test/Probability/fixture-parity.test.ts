import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Match, Number as N, Schema } from "effect"

import { normalCdf, normalPdf, shannonEntropy, uniformCdf, uniformPdf } from "../../src/Probability/operations.js"
import {
  FixtureRegistryLive,
  loadFixture,
  ProbabilityDistributionParityFixtureSchema
} from "../helpers/fixtures/index.js"

const NORMAL_PDF_TOLERANCE = 1e-14
const NORMAL_CDF_TOLERANCE = 2e-7 // Abramowitz & Stegun 7.1.26: ~1.5e-7 max error
const UNIFORM_TOLERANCE = 1e-14
const ENTROPY_TOLERANCE = 1e-12

const expectWithinTolerance = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

describe("Probability SciPy fixture parity", () => {
  it.effect("all distribution-parity cases match SciPy reference values", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("probability.distribution-parity")
      const fixture = yield* Schema.decodeUnknown(ProbabilityDistributionParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Arr.fromIterable(fixture.payload.cases), (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "normalPdf" }, (v) =>
              expectWithinTolerance(normalPdf(v.input.x, v.input.mu, v.input.sigma), v.expected, NORMAL_PDF_TOLERANCE)),
            Match.when({ operation: "normalCdf" }, (v) =>
              expectWithinTolerance(normalCdf(v.input.x, v.input.mu, v.input.sigma), v.expected, NORMAL_CDF_TOLERANCE)),
            Match.when({ operation: "uniformPdf" }, (v) =>
              expectWithinTolerance(
                uniformPdf(v.input.x, v.input.low, v.input.high),
                v.expected,
                UNIFORM_TOLERANCE
              )),
            Match.when({ operation: "uniformCdf" }, (v) =>
              expectWithinTolerance(
                uniformCdf(v.input.x, v.input.low, v.input.high),
                v.expected,
                UNIFORM_TOLERANCE
              )),
            Match.when({ operation: "entropy" }, (v) =>
              expectWithinTolerance(
                shannonEntropy(Chunk.fromIterable(v.input.probabilities)),
                v.expected,
                ENTROPY_TOLERANCE
              )),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
