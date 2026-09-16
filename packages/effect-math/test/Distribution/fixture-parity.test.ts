import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array, Chunk, Effect, Match, Number, Schema } from "effect"

import {
  betaCdf,
  betaEntropy,
  betaLogpdf,
  betaMean,
  betaPdf,
  betaQuantile,
  betaVariance,
  binomialCdf,
  binomialLogpmf,
  binomialMean,
  binomialPmf,
  binomialVariance,
  categoricalCdf,
  categoricalEntropy,
  categoricalLogpmf,
  categoricalMean,
  categoricalPmf,
  categoricalVariance,
  exponentialCdf,
  exponentialEntropy,
  exponentialLogpdf,
  exponentialMean,
  exponentialPdf,
  exponentialQuantile,
  exponentialVariance,
  gammaCdf,
  gammaEntropy,
  gammaLogpdf,
  gammaMean,
  gammaPdf,
  gammaQuantile,
  gammaVariance,
  logNormalCdf,
  logNormalEntropy,
  logNormalLogpdf,
  logNormalMean,
  logNormalPdf,
  logNormalQuantile,
  logNormalVariance,
  normalCdf,
  normalEntropy,
  normalLogpdf,
  normalMean,
  normalPdf,
  normalQuantile,
  normalVariance,
  poissonCdf,
  poissonLogpmf,
  poissonMean,
  poissonPmf,
  poissonVariance,
  studentTCdf,
  studentTLogpdf,
  studentTMean,
  studentTPdf,
  studentTQuantile,
  studentTVariance,
  uniformCdf,
  uniformEntropy,
  uniformLogpdf,
  uniformMean,
  uniformPdf,
  uniformQuantile,
  uniformVariance
} from "../../src/Distribution.js"
import { abs } from "../../src/Numeric.js"
import { DistributionAlgebraParityFixtureSchema, loadFixture } from "../helpers/fixtures/index.js"

const pdfTolerance = 1e-12
const cdfTolerance = 2e-12
const quantileTolerance = 1e-6
const betaincTolerance = 1e-10
const momentTolerance = 2e-12

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(abs(Number.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

const loadAllCases = Effect.gen(function*() {
  const raw = yield* loadFixture("distribution.algebra-parity")
  const fixture = yield* Schema.decodeUnknown(DistributionAlgebraParityFixtureSchema)(raw, {
    onExcessProperty: "error"
  })
  return Array.fromIterable(fixture.payload.cases)
})

describe("Distribution SciPy fixture parity", () => {
  it.effect("all distribution families match SciPy", () =>
    Effect.gen(function*() {
      const allCases = yield* loadAllCases
      yield* Effect.forEach(allCases, (c) =>
        Effect.sync(() => {
          const normal = Match.value(c).pipe(
            Match.when(
              { operation: "normalPdf" },
              (v) => expectClose(normalPdf(v.input.x, v.input.mu, v.input.sigma), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "normalLogpdf" },
              (v) => expectClose(normalLogpdf(v.input.x, v.input.mu, v.input.sigma), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "normalCdf" },
              (v) => expectClose(normalCdf(v.input.x, v.input.mu, v.input.sigma), v.expected, cdfTolerance)
            ),
            Match.when(
              { operation: "normalQuantile" },
              (v) => expectClose(normalQuantile(v.input.p, v.input.mu, v.input.sigma), v.expected, quantileTolerance)
            ),
            Match.when(
              { operation: "normalMean" },
              (v) => expectClose(normalMean(v.input.mu, v.input.sigma), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "normalVariance" },
              (v) => expectClose(normalVariance(v.input.mu, v.input.sigma), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "normalEntropy" },
              (v) => expectClose(normalEntropy(v.input.mu, v.input.sigma), v.expected, momentTolerance)
            )
          )
          const logNormal = normal.pipe(
            Match.when(
              { operation: "logNormalPdf" },
              (v) => expectClose(logNormalPdf(v.input.x, v.input.mu, v.input.sigma), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "logNormalLogpdf" },
              (v) => expectClose(logNormalLogpdf(v.input.x, v.input.mu, v.input.sigma), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "logNormalCdf" },
              (v) => expectClose(logNormalCdf(v.input.x, v.input.mu, v.input.sigma), v.expected, cdfTolerance)
            ),
            Match.when(
              { operation: "logNormalQuantile" },
              (v) => expectClose(logNormalQuantile(v.input.p, v.input.mu, v.input.sigma), v.expected, quantileTolerance)
            ),
            Match.when(
              { operation: "logNormalMean" },
              (v) => expectClose(logNormalMean(v.input.mu, v.input.sigma), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "logNormalVariance" },
              (v) => expectClose(logNormalVariance(v.input.mu, v.input.sigma), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "logNormalEntropy" },
              (v) => expectClose(logNormalEntropy(v.input.mu, v.input.sigma), v.expected, momentTolerance)
            )
          )
          const exponential = logNormal.pipe(
            Match.when(
              { operation: "exponentialPdf" },
              (v) => expectClose(exponentialPdf(v.input.x, v.input.rate), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "exponentialLogpdf" },
              (v) => expectClose(exponentialLogpdf(v.input.x, v.input.rate), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "exponentialCdf" },
              (v) => expectClose(exponentialCdf(v.input.x, v.input.rate), v.expected, cdfTolerance)
            ),
            Match.when(
              { operation: "exponentialQuantile" },
              (v) => expectClose(exponentialQuantile(v.input.p, v.input.rate), v.expected, quantileTolerance)
            ),
            Match.when(
              { operation: "exponentialMean" },
              (v) => expectClose(exponentialMean(v.input.rate), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "exponentialVariance" },
              (v) => expectClose(exponentialVariance(v.input.rate), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "exponentialEntropy" },
              (v) => expectClose(exponentialEntropy(v.input.rate), v.expected, momentTolerance)
            )
          )
          const uniform = exponential.pipe(
            Match.when(
              { operation: "uniformPdf" },
              (v) => expectClose(uniformPdf(v.input.x, v.input.low, v.input.high), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "uniformLogpdf" },
              (v) => expectClose(uniformLogpdf(v.input.x, v.input.low, v.input.high), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "uniformCdf" },
              (v) => expectClose(uniformCdf(v.input.x, v.input.low, v.input.high), v.expected, cdfTolerance)
            ),
            Match.when(
              { operation: "uniformQuantile" },
              (v) => expectClose(uniformQuantile(v.input.p, v.input.low, v.input.high), v.expected, quantileTolerance)
            ),
            Match.when(
              { operation: "uniformMean" },
              (v) => expectClose(uniformMean(v.input.low, v.input.high), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "uniformVariance" },
              (v) => expectClose(uniformVariance(v.input.low, v.input.high), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "uniformEntropy" },
              (v) => expectClose(uniformEntropy(v.input.low, v.input.high), v.expected, momentTolerance)
            )
          )
          const beta = uniform.pipe(
            Match.when(
              { operation: "betaPdf" },
              (v) => expectClose(betaPdf(v.input.x, v.input.alpha, v.input.beta), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "betaLogpdf" },
              (v) => expectClose(betaLogpdf(v.input.x, v.input.alpha, v.input.beta), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "betaCdf" },
              (v) => expectClose(betaCdf(v.input.x, v.input.alpha, v.input.beta), v.expected, betaincTolerance)
            ),
            Match.when(
              { operation: "betaQuantile" },
              (v) => expectClose(betaQuantile(v.input.p, v.input.alpha, v.input.beta), v.expected, quantileTolerance)
            ),
            Match.when(
              { operation: "betaMean" },
              (v) => expectClose(betaMean(v.input.alpha, v.input.beta), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "betaVariance" },
              (v) => expectClose(betaVariance(v.input.alpha, v.input.beta), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "betaEntropy" },
              (v) => expectClose(betaEntropy(v.input.alpha, v.input.beta), v.expected, momentTolerance)
            )
          )
          const gamma = beta.pipe(
            Match.when(
              { operation: "gammaPdf" },
              (v) => expectClose(gammaPdf(v.input.x, v.input.shape, v.input.scale), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "gammaLogpdf" },
              (v) => expectClose(gammaLogpdf(v.input.x, v.input.shape, v.input.scale), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "gammaCdf" },
              (v) => expectClose(gammaCdf(v.input.x, v.input.shape, v.input.scale), v.expected, betaincTolerance)
            ),
            Match.when(
              { operation: "gammaQuantile" },
              (v) => expectClose(gammaQuantile(v.input.p, v.input.shape, v.input.scale), v.expected, quantileTolerance)
            ),
            Match.when(
              { operation: "gammaMean" },
              (v) => expectClose(gammaMean(v.input.shape, v.input.scale), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "gammaVariance" },
              (v) => expectClose(gammaVariance(v.input.shape, v.input.scale), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "gammaEntropy" },
              (v) => expectClose(gammaEntropy(v.input.shape, v.input.scale), v.expected, momentTolerance)
            )
          )
          const studentT = gamma.pipe(
            Match.when(
              { operation: "studentTPdf" },
              (v) => expectClose(studentTPdf(v.input.x, v.input.df), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "studentTLogpdf" },
              (v) => expectClose(studentTLogpdf(v.input.x, v.input.df), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "studentTCdf" },
              (v) => expectClose(studentTCdf(v.input.x, v.input.df), v.expected, betaincTolerance)
            ),
            Match.when(
              { operation: "studentTQuantile" },
              (v) => expectClose(studentTQuantile(v.input.p, v.input.df), v.expected, quantileTolerance)
            ),
            Match.when(
              { operation: "studentTMean" },
              (v) => expectClose(studentTMean(v.input.df), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "studentTVariance" },
              (v) => expectClose(studentTVariance(v.input.df), v.expected, momentTolerance)
            )
          )
          const categorical = studentT.pipe(
            Match.when(
              { operation: "categoricalPmf" },
              (v) => expectClose(categoricalPmf(v.input.k, Chunk.fromIterable(v.input.probs)), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "categoricalLogpmf" },
              (v) =>
                expectClose(categoricalLogpmf(v.input.k, Chunk.fromIterable(v.input.probs)), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "categoricalCdf" },
              (v) =>
                expectClose(categoricalCdf(v.input.k, Chunk.fromIterable(v.input.probs)), v.expected, betaincTolerance)
            ),
            Match.when(
              { operation: "categoricalMean" },
              (v) => expectClose(categoricalMean(Chunk.fromIterable(v.input.probs)), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "categoricalVariance" },
              (v) => expectClose(categoricalVariance(Chunk.fromIterable(v.input.probs)), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "categoricalEntropy" },
              (v) => expectClose(categoricalEntropy(Chunk.fromIterable(v.input.probs)), v.expected, momentTolerance)
            )
          )
          const binomial = categorical.pipe(
            Match.when(
              { operation: "binomialPmf" },
              (v) => expectClose(binomialPmf(v.input.k, v.input.n, v.input.p), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "binomialLogpmf" },
              (v) => expectClose(binomialLogpmf(v.input.k, v.input.n, v.input.p), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "binomialCdf" },
              (v) => expectClose(binomialCdf(v.input.k, v.input.n, v.input.p), v.expected, betaincTolerance)
            ),
            Match.when(
              { operation: "binomialMean" },
              (v) => expectClose(binomialMean(v.input.n, v.input.p), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "binomialVariance" },
              (v) => expectClose(binomialVariance(v.input.n, v.input.p), v.expected, momentTolerance)
            )
          )
          return binomial.pipe(
            Match.when(
              { operation: "poissonPmf" },
              (v) => expectClose(poissonPmf(v.input.k, v.input.mu), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "poissonLogpmf" },
              (v) => expectClose(poissonLogpmf(v.input.k, v.input.mu), v.expected, pdfTolerance)
            ),
            Match.when(
              { operation: "poissonCdf" },
              (v) => expectClose(poissonCdf(v.input.k, v.input.mu), v.expected, betaincTolerance)
            ),
            Match.when(
              { operation: "poissonMean" },
              (v) => expectClose(poissonMean(v.input.mu), v.expected, momentTolerance)
            ),
            Match.when(
              { operation: "poissonVariance" },
              (v) => expectClose(poissonVariance(v.input.mu), v.expected, momentTolerance)
            ),
            Match.exhaustive
          )
        }))
    }).pipe(Effect.provide(BunContext.layer)))
})
