import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Either, Option, Schema } from "effect"

import * as Float64 from "../../src/internal/float64.js"
import {
  cdf,
  cdfEffect,
  logPdf,
  logPdfEffect,
  sample,
  sampleEffect,
  TruncatedNormalParams
} from "../../src/internal/tpe/truncatedNormal.js"
import { FixtureRegistryLive, loadFixture, TruncatedNormalFixtureSchema } from "../helpers/fixtures.js"

const CDF_ABSOLUTE_TOLERANCE = 1e-12
const LOG_PDF_ABSOLUTE_TOLERANCE = 1e-9
const SAMPLE_ABSOLUTE_TOLERANCE = 1e-10

const REQUIRED_STRESS_CASE_IDS = Arr.make(
  "micro-support-far-right-mean",
  "micro-support-far-left-mean",
  "mean-near-low-bound-tiny-window",
  "mean-near-high-bound-tiny-window"
)

type TruncatedFixtureCase = Schema.Schema.Type<typeof TruncatedNormalFixtureSchema>["payload"]["cases"][number]

const toParams = (entry: TruncatedFixtureCase): TruncatedNormalParams => new TruncatedNormalParams(entry.params)

const numberAt = (values: ReadonlyArray<number>, index: number): number =>
  Arr.get(values, index).pipe(Option.getOrElse(() => Number.NaN))

const loadTruncatedFixture = loadFixture("truncated-normal.edge-cases").pipe(
  Effect.provide(FixtureRegistryLive),
  Effect.flatMap((fixture) => Schema.decodeUnknown(TruncatedNormalFixtureSchema)(fixture))
)

const firstParams = (
  fixture: Schema.Schema.Type<typeof TruncatedNormalFixtureSchema>
): Option.Option<TruncatedNormalParams> => Arr.head(fixture.payload.cases).pipe(Option.map(toParams))

const assertAbsoluteTolerance = (actual: number, expected: number, tolerance: number): void => {
  if (Number.isNaN(expected)) {
    expect(Number.isNaN(actual)).toBe(true)
    return
  }

  if (!Number.isFinite(expected)) {
    expect(actual).toBe(expected)
    return
  }

  expect(Float64.abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

describe("truncated normal fixture parity", () => {
  it.effect("matches Optuna-derived sample fixtures within absolute tolerance 1e-10", () =>
    Effect.gen(function*() {
      const fixture = yield* loadTruncatedFixture

      yield* Effect.forEach(
        fixture.payload.cases,
        (entry) =>
          Effect.gen(function*() {
            const params = toParams(entry)

            yield* Effect.sync(() => {
              expect(entry.sampleQuantiles.length, `${entry.id} sample fixtures are present`).toBeGreaterThan(0)
            })

            yield* Effect.forEach(
              entry.sampleQuantiles,
              (quantile, index) =>
                Effect.sync(() => {
                  const actual = sample(quantile, params)
                  const expected = numberAt(entry.sampleExpected, index)

                  assertAbsoluteTolerance(actual, expected, SAMPLE_ABSOLUTE_TOLERANCE)
                }),
              { discard: true }
            )
          }),
        { discard: true }
      )
    }))

  it.effect("matches Optuna-derived cdf fixtures within absolute tolerance 1e-12", () =>
    Effect.gen(function*() {
      const fixture = yield* loadTruncatedFixture

      yield* Effect.forEach(
        fixture.payload.cases,
        (entry) =>
          Effect.gen(function*() {
            const params = toParams(entry)

            yield* Effect.sync(() => {
              expect(entry.cdfProbes.length, `${entry.id} cdf fixtures are present`).toBeGreaterThan(0)
            })

            yield* Effect.forEach(
              entry.cdfProbes,
              (probe, index) =>
                Effect.sync(() => {
                  const actual = cdf(probe, params)
                  const expected = numberAt(entry.cdfExpected, index)

                  assertAbsoluteTolerance(actual, expected, CDF_ABSOLUTE_TOLERANCE)
                }),
              { discard: true }
            )
          }),
        { discard: true }
      )
    }))

  it.effect("matches Optuna-derived logPdf fixtures within absolute tolerance 1e-9", () =>
    Effect.gen(function*() {
      const fixture = yield* loadTruncatedFixture

      yield* Effect.forEach(
        fixture.payload.cases,
        (entry) =>
          Effect.gen(function*() {
            const params = toParams(entry)

            yield* Effect.sync(() => {
              expect(entry.logPdfProbes.length, `${entry.id} logPdf fixtures are present`).toBeGreaterThan(0)
            })

            yield* Effect.forEach(
              entry.logPdfProbes,
              (probe, index) =>
                Effect.sync(() => {
                  const actual = logPdf(probe, params)
                  const expected = numberAt(entry.logPdfExpected, index)

                  assertAbsoluteTolerance(actual, expected, LOG_PDF_ABSOLUTE_TOLERANCE)
                }),
              { discard: true }
            )
          }),
        { discard: true }
      )
    }))

  it.effect("includes expanded stress fixtures and keeps deterministic boundary contracts", () =>
    Effect.gen(function*() {
      const fixture = yield* loadTruncatedFixture
      const caseIds = Arr.map(fixture.payload.cases, (entry) => entry.id)
      const stressCases = Arr.filter(fixture.payload.cases, (entry) => Arr.contains(REQUIRED_STRESS_CASE_IDS, entry.id))

      yield* Effect.sync(() => {
        expect(Arr.every(REQUIRED_STRESS_CASE_IDS, (id) => Arr.contains(caseIds, id))).toBe(true)
      })

      yield* Effect.forEach(
        stressCases,
        (entry) =>
          Effect.sync(() => {
            const params = toParams(entry)

            expect(Float64.abs(sample(0, params) - params.low)).toBeLessThanOrEqual(SAMPLE_ABSOLUTE_TOLERANCE)
            expect(Float64.abs(sample(1, params) - params.high)).toBeLessThanOrEqual(SAMPLE_ABSOLUTE_TOLERANCE)
            expect(Float64.abs(cdf(params.low, params) - 0)).toBeLessThanOrEqual(CDF_ABSOLUTE_TOLERANCE)
            expect(Float64.abs(cdf(params.high, params) - 1)).toBeLessThanOrEqual(CDF_ABSOLUTE_TOLERANCE)
          }),
        { discard: true }
      )
    }))

  it.effect("keeps support semantics and invalid-domain handling", () =>
    Effect.gen(function*() {
      const fixture = yield* loadTruncatedFixture
      const centeredParamsOption = firstParams(fixture)
      const invalidParams = new TruncatedNormalParams({
        mean: 0,
        sigma: 0,
        low: -1,
        high: 1
      })

      yield* Effect.sync(() => {
        expect(Option.isSome(centeredParamsOption)).toBe(true)
      })

      if (Option.isNone(centeredParamsOption)) {
        return
      }
      const centeredParams = centeredParamsOption.value

      yield* Effect.sync(() => {
        expect(logPdf(-0.1, centeredParams)).toBe(Number.NEGATIVE_INFINITY)
        expect(logPdf(1.1, centeredParams)).toBe(Number.NEGATIVE_INFINITY)

        expect(Number.isNaN(logPdf(0, invalidParams))).toBe(true)
        expect(Number.isNaN(cdf(0, invalidParams))).toBe(true)
        expect(Number.isNaN(sample(0.5, invalidParams))).toBe(true)
      })
    }))

  it.effect("provides typed error channels for invalid math inputs", () =>
    Effect.gen(function*() {
      const fixture = yield* loadTruncatedFixture
      const centeredParamsOption = firstParams(fixture)
      const invalidParams = new TruncatedNormalParams({
        mean: 0,
        sigma: 0,
        low: -1,
        high: 1
      })
      const validParams = Option.getOrElse(centeredParamsOption, () => invalidParams)

      const invalidLogPdf = yield* Effect.either(logPdfEffect(0, invalidParams))
      const invalidCdf = yield* Effect.either(cdfEffect(0, invalidParams))
      const invalidSample = yield* Effect.either(sampleEffect(1.1, validParams))

      expect(Either.isLeft(invalidLogPdf)).toBe(true)
      expect(Either.isLeft(invalidCdf)).toBe(true)
      expect(Either.isLeft(invalidSample)).toBe(true)

      if (Either.isLeft(invalidLogPdf)) {
        expect(invalidLogPdf.left._tag).toBe("effect-search/InvalidMathInput")
      }

      if (Either.isLeft(invalidCdf)) {
        expect(invalidCdf.left._tag).toBe("effect-search/InvalidMathInput")
      }

      if (Either.isLeft(invalidSample)) {
        expect(invalidSample.left._tag).toBe("effect-search/InvalidMathInput")
      }
    }))

  it.effect("effectful math matches pure outputs on valid inputs", () =>
    Effect.gen(function*() {
      const fixture = yield* loadTruncatedFixture
      const centeredParamsOption = firstParams(fixture)

      yield* Effect.sync(() => {
        expect(Option.isSome(centeredParamsOption)).toBe(true)
      })

      if (Option.isNone(centeredParamsOption)) {
        return
      }
      const centeredParams = centeredParamsOption.value

      const q = 0.37
      const x = 0.62
      const effectSample = yield* sampleEffect(q, centeredParams)
      const effectCdf = yield* cdfEffect(x, centeredParams)
      const effectLogPdf = yield* logPdfEffect(x, centeredParams)

      expect(Float64.abs(effectSample - sample(q, centeredParams))).toBeLessThanOrEqual(
        SAMPLE_ABSOLUTE_TOLERANCE
      )
      expect(Float64.abs(effectCdf - cdf(x, centeredParams))).toBeLessThanOrEqual(CDF_ABSOLUTE_TOLERANCE)
      expect(Float64.abs(effectLogPdf - logPdf(x, centeredParams))).toBeLessThanOrEqual(
        LOG_PDF_ABSOLUTE_TOLERANCE
      )
    }))
})
