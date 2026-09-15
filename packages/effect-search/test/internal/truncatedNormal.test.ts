import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean, Effect, Either, Match, Number as Num, Option, Schema } from "effect"

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

type TruncatedFixtureCase = Schema.Schema.Type<typeof TruncatedNormalFixtureSchema>["payload"]["cases"][number]

const toParams = (entry: TruncatedFixtureCase): TruncatedNormalParams => new TruncatedNormalParams(entry.params)

const numberAt = (values: Schema.Array$<typeof Schema.Number>["Type"], index: number): number =>
  Arr.get(values, index).pipe(Option.getOrElse(() => Number.NaN))

const loadTruncatedFixture = loadFixture("truncated-normal.edge-cases").pipe(
  Effect.provide(FixtureRegistryLive),
  Effect.flatMap((fixture) => Schema.decodeUnknown(TruncatedNormalFixtureSchema)(fixture))
)

const firstParams = (
  fixture: Schema.Schema.Type<typeof TruncatedNormalFixtureSchema>
): Option.Option<TruncatedNormalParams> => Arr.head(fixture.payload.cases).pipe(Option.map(toParams))

const isFinite = Schema.is(Schema.Finite)
const isNonNaN = Schema.is(Schema.NonNaN)

const assertAbsoluteTolerance = (actual: number, expected: number, tolerance: number): void => {
  Match.value(expected).pipe(
    Match.when((value) => Boolean.not(isNonNaN(value)), () => {
      expect(Boolean.not(isNonNaN(actual))).toBe(true)
    }),
    Match.when((value) => Boolean.not(isFinite(value)), () => {
      expect(actual).toBe(expected)
    }),
    Match.orElse(() => {
      expect(Float64.abs(Num.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
    })
  )
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

  it.effect("maps the unit interval onto the support and the support onto [0, 1] for every case", () =>
    Effect.gen(function*() {
      const fixture = yield* loadTruncatedFixture

      yield* Effect.forEach(
        fixture.payload.cases,
        (entry) =>
          Effect.sync(() => {
            const params = toParams(entry)

            expect(Float64.abs(Num.subtract(sample(0, params), params.low))).toBeLessThanOrEqual(
              SAMPLE_ABSOLUTE_TOLERANCE
            )
            expect(Float64.abs(Num.subtract(sample(1, params), params.high))).toBeLessThanOrEqual(
              SAMPLE_ABSOLUTE_TOLERANCE
            )
            expect(Float64.abs(Num.subtract(cdf(params.low, params), 0))).toBeLessThanOrEqual(CDF_ABSOLUTE_TOLERANCE)
            expect(Float64.abs(Num.subtract(cdf(params.high, params), 1))).toBeLessThanOrEqual(CDF_ABSOLUTE_TOLERANCE)
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

      const centeredParams = yield* centeredParamsOption

      yield* Effect.sync(() => {
        expect(logPdf(-0.1, centeredParams)).toBe(Number.NEGATIVE_INFINITY)
        expect(logPdf(1.1, centeredParams)).toBe(Number.NEGATIVE_INFINITY)

        expect(Boolean.not(isNonNaN(logPdf(0, invalidParams)))).toBe(true)
        expect(Boolean.not(isNonNaN(cdf(0, invalidParams)))).toBe(true)
        expect(Boolean.not(isNonNaN(sample(0.5, invalidParams)))).toBe(true)
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

      Either.match(invalidLogPdf, {
        onLeft: (error) => expect(error._tag).toBe("effect-search/InvalidMathInput"),
        onRight: () => expect.unreachable("invalid logPdf unexpectedly succeeded")
      })
      Either.match(invalidCdf, {
        onLeft: (error) => expect(error._tag).toBe("effect-search/InvalidMathInput"),
        onRight: () => expect.unreachable("invalid cdf unexpectedly succeeded")
      })
      Either.match(invalidSample, {
        onLeft: (error) => expect(error._tag).toBe("effect-search/InvalidMathInput"),
        onRight: () => expect.unreachable("invalid sample unexpectedly succeeded")
      })
    }))

  it.effect("effectful math matches pure outputs on valid inputs", () =>
    Effect.gen(function*() {
      const fixture = yield* loadTruncatedFixture
      const centeredParamsOption = firstParams(fixture)

      yield* Effect.sync(() => {
        expect(Option.isSome(centeredParamsOption)).toBe(true)
      })

      const centeredParams = yield* centeredParamsOption

      const q = 0.37
      const x = 0.62
      const effectSample = yield* sampleEffect(q, centeredParams)
      const effectCdf = yield* cdfEffect(x, centeredParams)
      const effectLogPdf = yield* logPdfEffect(x, centeredParams)

      expect(Float64.abs(Num.subtract(effectSample, sample(q, centeredParams)))).toBeLessThanOrEqual(
        SAMPLE_ABSOLUTE_TOLERANCE
      )
      expect(Float64.abs(Num.subtract(effectCdf, cdf(x, centeredParams)))).toBeLessThanOrEqual(CDF_ABSOLUTE_TOLERANCE)
      expect(Float64.abs(Num.subtract(effectLogPdf, logPdf(x, centeredParams)))).toBeLessThanOrEqual(
        LOG_PDF_ABSOLUTE_TOLERANCE
      )
    }))
})

describe("float64 host mathematical leaves", () => {
  it.effect("preserves signed zero, NaN, and infinity behavior", () =>
    Effect.sync(() => {
      expect(Float64.abs(-0)).toBe(-0)
      expect(Float64.sqrt(4)).toBe(2)
      expect(Boolean.not(isNonNaN(Float64.sqrt(-1)))).toBe(true)
      expect(Boolean.not(isNonNaN(Float64.sqrt(Number.NaN)))).toBe(true)
      expect(Float64.sqrt(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY)
      expect(Boolean.not(isNonNaN(Float64.exp(Number.NaN)))).toBe(true)
      expect(Float64.exp(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY)
      expect(Float64.exp(Number.NEGATIVE_INFINITY)).toBe(0)
    }))
})
