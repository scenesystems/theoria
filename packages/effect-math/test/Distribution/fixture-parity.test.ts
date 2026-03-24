import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Match, Number as N, Schema } from "effect"

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
} from "../../src/Distribution/operations.js"
import { DistributionAlgebraParityFixtureSchema, FixtureRegistryLive, loadFixture } from "../helpers/fixtures/index.js"

const PDF_TOL = 1e-12
const CDF_TOL = 1e-7
const QUANTILE_TOL = 1e-6
const BETAINC_TOL = 1e-10
const MOMENT_TOL = 2e-12

const expectClose = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

const loadAllCases = Effect.gen(function*() {
  const raw = yield* loadFixture("distribution.algebra-parity")
  const fixture = yield* Schema.decodeUnknown(DistributionAlgebraParityFixtureSchema)(raw, {
    onExcessProperty: "error"
  })
  return Arr.fromIterable(fixture.payload.cases)
})

describe("Distribution SciPy fixture parity", () => {
  it.effect("normal family cases match SciPy", () =>
    Effect.gen(function*() {
      const allCases = yield* loadAllCases
      const cases = Arr.filter(allCases, (c) => c.operation.startsWith("normal"))
      yield* Effect.forEach(cases, (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "normalPdf" }, (v) =>
              expectClose(normalPdf(v.input.x, v.input.mu, v.input.sigma), v.expected, PDF_TOL)),
            Match.when({ operation: "normalLogpdf" }, (v) =>
              expectClose(normalLogpdf(v.input.x, v.input.mu, v.input.sigma), v.expected, PDF_TOL)),
            Match.when({ operation: "normalCdf" }, (v) =>
              expectClose(normalCdf(v.input.x, v.input.mu, v.input.sigma), v.expected, CDF_TOL)),
            Match.when({ operation: "normalQuantile" }, (v) =>
              expectClose(normalQuantile(v.input.p, v.input.mu, v.input.sigma), v.expected, QUANTILE_TOL)),
            Match.when({ operation: "normalMean" }, (v) =>
              expectClose(normalMean(v.input.mu, v.input.sigma), v.expected, MOMENT_TOL)),
            Match.when({ operation: "normalVariance" }, (v) =>
              expectClose(normalVariance(v.input.mu, v.input.sigma), v.expected, MOMENT_TOL)),
            Match.when({ operation: "normalEntropy" }, (v) =>
              expectClose(normalEntropy(v.input.mu, v.input.sigma), v.expected, MOMENT_TOL)),
            Match.orElse(() => {})
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("logNormal family cases match SciPy", () =>
    Effect.gen(function*() {
      const allCases = yield* loadAllCases
      const cases = Arr.filter(allCases, (c) => c.operation.startsWith("logNormal"))
      yield* Effect.forEach(cases, (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "logNormalPdf" }, (v) =>
              expectClose(logNormalPdf(v.input.x, v.input.mu, v.input.sigma), v.expected, PDF_TOL)),
            Match.when({ operation: "logNormalLogpdf" }, (v) =>
              expectClose(logNormalLogpdf(v.input.x, v.input.mu, v.input.sigma), v.expected, PDF_TOL)),
            Match.when({ operation: "logNormalCdf" }, (v) =>
              expectClose(logNormalCdf(v.input.x, v.input.mu, v.input.sigma), v.expected, CDF_TOL)),
            Match.when({ operation: "logNormalQuantile" }, (v) =>
              expectClose(logNormalQuantile(v.input.p, v.input.mu, v.input.sigma), v.expected, QUANTILE_TOL)),
            Match.when({ operation: "logNormalMean" }, (v) =>
              expectClose(logNormalMean(v.input.mu, v.input.sigma), v.expected, MOMENT_TOL)),
            Match.when({ operation: "logNormalVariance" }, (v) =>
              expectClose(logNormalVariance(v.input.mu, v.input.sigma), v.expected, MOMENT_TOL)),
            Match.when({ operation: "logNormalEntropy" }, (v) =>
              expectClose(logNormalEntropy(v.input.mu, v.input.sigma), v.expected, MOMENT_TOL)),
            Match.orElse(() => {})
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("exponential family cases match SciPy", () =>
    Effect.gen(function*() {
      const allCases = yield* loadAllCases
      const cases = Arr.filter(allCases, (c) => c.operation.startsWith("exponential"))
      yield* Effect.forEach(cases, (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "exponentialPdf" }, (v) =>
              expectClose(exponentialPdf(v.input.x, v.input.rate), v.expected, PDF_TOL)),
            Match.when({ operation: "exponentialLogpdf" }, (v) =>
              expectClose(exponentialLogpdf(v.input.x, v.input.rate), v.expected, PDF_TOL)),
            Match.when({ operation: "exponentialCdf" }, (v) =>
              expectClose(exponentialCdf(v.input.x, v.input.rate), v.expected, CDF_TOL)),
            Match.when({ operation: "exponentialQuantile" }, (v) =>
              expectClose(exponentialQuantile(v.input.p, v.input.rate), v.expected, QUANTILE_TOL)),
            Match.when({ operation: "exponentialMean" }, (v) =>
              expectClose(exponentialMean(v.input.rate), v.expected, MOMENT_TOL)),
            Match.when({ operation: "exponentialVariance" }, (v) =>
              expectClose(exponentialVariance(v.input.rate), v.expected, MOMENT_TOL)),
            Match.when({ operation: "exponentialEntropy" }, (v) =>
              expectClose(exponentialEntropy(v.input.rate), v.expected, MOMENT_TOL)),
            Match.orElse(() => {})
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("uniform family cases match SciPy", () =>
    Effect.gen(function*() {
      const allCases = yield* loadAllCases
      const cases = Arr.filter(allCases, (c) => c.operation.startsWith("uniform"))
      yield* Effect.forEach(cases, (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "uniformPdf" }, (v) =>
              expectClose(uniformPdf(v.input.x, v.input.low, v.input.high), v.expected, PDF_TOL)),
            Match.when({ operation: "uniformLogpdf" }, (v) =>
              expectClose(uniformLogpdf(v.input.x, v.input.low, v.input.high), v.expected, PDF_TOL)),
            Match.when({ operation: "uniformCdf" }, (v) =>
              expectClose(uniformCdf(v.input.x, v.input.low, v.input.high), v.expected, CDF_TOL)),
            Match.when({ operation: "uniformQuantile" }, (v) =>
              expectClose(uniformQuantile(v.input.p, v.input.low, v.input.high), v.expected, QUANTILE_TOL)),
            Match.when({ operation: "uniformMean" }, (v) =>
              expectClose(uniformMean(v.input.low, v.input.high), v.expected, MOMENT_TOL)),
            Match.when({ operation: "uniformVariance" }, (v) =>
              expectClose(uniformVariance(v.input.low, v.input.high), v.expected, MOMENT_TOL)),
            Match.when({ operation: "uniformEntropy" }, (v) =>
              expectClose(uniformEntropy(v.input.low, v.input.high), v.expected, MOMENT_TOL)),
            Match.orElse(() => {})
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("beta family cases match SciPy", () =>
    Effect.gen(function*() {
      const allCases = yield* loadAllCases
      const cases = Arr.filter(allCases, (c) => c.operation.startsWith("beta"))
      yield* Effect.forEach(cases, (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "betaPdf" }, (v) =>
              expectClose(betaPdf(v.input.x, v.input.alpha, v.input.beta), v.expected, PDF_TOL)),
            Match.when({ operation: "betaLogpdf" }, (v) =>
              expectClose(betaLogpdf(v.input.x, v.input.alpha, v.input.beta), v.expected, PDF_TOL)),
            Match.when({ operation: "betaCdf" }, (v) =>
              expectClose(betaCdf(v.input.x, v.input.alpha, v.input.beta), v.expected, BETAINC_TOL)),
            Match.when({ operation: "betaQuantile" }, (v) =>
              expectClose(betaQuantile(v.input.p, v.input.alpha, v.input.beta), v.expected, QUANTILE_TOL)),
            Match.when({ operation: "betaMean" }, (v) =>
              expectClose(betaMean(v.input.alpha, v.input.beta), v.expected, MOMENT_TOL)),
            Match.when({ operation: "betaVariance" }, (v) =>
              expectClose(betaVariance(v.input.alpha, v.input.beta), v.expected, MOMENT_TOL)),
            Match.when({ operation: "betaEntropy" }, (v) =>
              expectClose(betaEntropy(v.input.alpha, v.input.beta), v.expected, MOMENT_TOL)),
            Match.orElse(() => {})
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("gamma family cases match SciPy", () =>
    Effect.gen(function*() {
      const allCases = yield* loadAllCases
      const cases = Arr.filter(allCases, (c) => c.operation.startsWith("gamma"))
      yield* Effect.forEach(cases, (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "gammaPdf" }, (v) =>
              expectClose(gammaPdf(v.input.x, v.input.shape, v.input.scale), v.expected, PDF_TOL)),
            Match.when({ operation: "gammaLogpdf" }, (v) =>
              expectClose(gammaLogpdf(v.input.x, v.input.shape, v.input.scale), v.expected, PDF_TOL)),
            Match.when({ operation: "gammaCdf" }, (v) =>
              expectClose(gammaCdf(v.input.x, v.input.shape, v.input.scale), v.expected, BETAINC_TOL)),
            Match.when({ operation: "gammaQuantile" }, (v) =>
              expectClose(gammaQuantile(v.input.p, v.input.shape, v.input.scale), v.expected, QUANTILE_TOL)),
            Match.when({ operation: "gammaMean" }, (v) =>
              expectClose(gammaMean(v.input.shape, v.input.scale), v.expected, MOMENT_TOL)),
            Match.when({ operation: "gammaVariance" }, (v) =>
              expectClose(gammaVariance(v.input.shape, v.input.scale), v.expected, MOMENT_TOL)),
            Match.when({ operation: "gammaEntropy" }, (v) =>
              expectClose(gammaEntropy(v.input.shape, v.input.scale), v.expected, MOMENT_TOL)),
            Match.orElse(() => {})
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("studentT family cases match SciPy", () =>
    Effect.gen(function*() {
      const allCases = yield* loadAllCases
      const cases = Arr.filter(allCases, (c) => c.operation.startsWith("studentT"))
      yield* Effect.forEach(cases, (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "studentTPdf" }, (v) =>
              expectClose(studentTPdf(v.input.x, v.input.df), v.expected, PDF_TOL)),
            Match.when({ operation: "studentTLogpdf" }, (v) =>
              expectClose(studentTLogpdf(v.input.x, v.input.df), v.expected, PDF_TOL)),
            Match.when({ operation: "studentTCdf" }, (v) =>
              expectClose(studentTCdf(v.input.x, v.input.df), v.expected, BETAINC_TOL)),
            Match.when({ operation: "studentTQuantile" }, (v) =>
              expectClose(studentTQuantile(v.input.p, v.input.df), v.expected, QUANTILE_TOL)),
            Match.when({ operation: "studentTMean" }, (v) =>
              expectClose(studentTMean(v.input.df), v.expected, MOMENT_TOL)),
            Match.when({ operation: "studentTVariance" }, (v) =>
              expectClose(studentTVariance(v.input.df), v.expected, MOMENT_TOL)),
            Match.orElse(() => {})
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("categorical family cases match SciPy", () =>
    Effect.gen(function*() {
      const allCases = yield* loadAllCases
      const cases = Arr.filter(allCases, (c) => c.operation.startsWith("categorical"))
      yield* Effect.forEach(cases, (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "categoricalPmf" }, (v) =>
              expectClose(categoricalPmf(v.input.k, Chunk.fromIterable(v.input.probs)), v.expected, PDF_TOL)),
            Match.when({ operation: "categoricalLogpmf" }, (v) =>
              expectClose(categoricalLogpmf(v.input.k, Chunk.fromIterable(v.input.probs)), v.expected, PDF_TOL)),
            Match.when({ operation: "categoricalCdf" }, (v) =>
              expectClose(categoricalCdf(v.input.k, Chunk.fromIterable(v.input.probs)), v.expected, BETAINC_TOL)),
            Match.when({ operation: "categoricalMean" }, (v) =>
              expectClose(categoricalMean(Chunk.fromIterable(v.input.probs)), v.expected, MOMENT_TOL)),
            Match.when({ operation: "categoricalVariance" }, (v) =>
              expectClose(categoricalVariance(Chunk.fromIterable(v.input.probs)), v.expected, MOMENT_TOL)),
            Match.when({ operation: "categoricalEntropy" }, (v) =>
              expectClose(categoricalEntropy(Chunk.fromIterable(v.input.probs)), v.expected, MOMENT_TOL)),
            Match.orElse(() => {})
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("binomial family cases match SciPy", () =>
    Effect.gen(function*() {
      const allCases = yield* loadAllCases
      const cases = Arr.filter(allCases, (c) => c.operation.startsWith("binomial"))
      yield* Effect.forEach(cases, (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "binomialPmf" }, (v) =>
              expectClose(binomialPmf(v.input.k, v.input.n, v.input.p), v.expected, PDF_TOL)),
            Match.when({ operation: "binomialLogpmf" }, (v) =>
              expectClose(binomialLogpmf(v.input.k, v.input.n, v.input.p), v.expected, PDF_TOL)),
            Match.when({ operation: "binomialCdf" }, (v) =>
              expectClose(binomialCdf(v.input.k, v.input.n, v.input.p), v.expected, BETAINC_TOL)),
            Match.when({ operation: "binomialMean" }, (v) =>
              expectClose(binomialMean(v.input.n, v.input.p), v.expected, MOMENT_TOL)),
            Match.when({ operation: "binomialVariance" }, (v) =>
              expectClose(binomialVariance(v.input.n, v.input.p), v.expected, MOMENT_TOL)),
            Match.orElse(() => {})
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))

  it.effect("poisson family cases match SciPy", () =>
    Effect.gen(function*() {
      const allCases = yield* loadAllCases
      const cases = Arr.filter(allCases, (c) => c.operation.startsWith("poisson"))
      yield* Effect.forEach(cases, (c) =>
        Effect.sync(() =>
          Match.value(c).pipe(
            Match.when({ operation: "poissonPmf" }, (v) =>
              expectClose(poissonPmf(v.input.k, v.input.mu), v.expected, PDF_TOL)),
            Match.when({ operation: "poissonLogpmf" }, (v) =>
              expectClose(poissonLogpmf(v.input.k, v.input.mu), v.expected, PDF_TOL)),
            Match.when({ operation: "poissonCdf" }, (v) =>
              expectClose(poissonCdf(v.input.k, v.input.mu), v.expected, BETAINC_TOL)),
            Match.when({ operation: "poissonMean" }, (v) =>
              expectClose(poissonMean(v.input.mu), v.expected, MOMENT_TOL)),
            Match.when({ operation: "poissonVariance" }, (v) =>
              expectClose(poissonVariance(v.input.mu), v.expected, MOMENT_TOL)),
            Match.orElse(() => {})
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
