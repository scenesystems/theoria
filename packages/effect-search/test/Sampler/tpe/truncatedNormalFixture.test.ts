import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Either, Match, Number as Num, Option, Schema } from "effect"

import * as Numeric from "@scenesystems/effect-math/Numeric"
import {
  cdf,
  cdfEffect,
  logPdf,
  logPdfEffect,
  sample,
  sampleEffect,
  TruncatedNormalParams
} from "../../../src/internal/tpe/truncatedNormal.js"
import { prepareLogPdf, prepareSample } from "../../../src/internal/tpe/truncatedNormal/truncated.js"
import { FixtureRegistryLive, loadFixture, TruncatedNormalFixture } from "../../helpers/fixtures/index.js"

const CDF_ABSOLUTE_TOLERANCE = 1e-12
const LOG_PDF_ABSOLUTE_TOLERANCE = 1e-9
const SAMPLE_ABSOLUTE_TOLERANCE = 1e-10

type TruncatedFixtureCase = Schema.Schema.Type<typeof TruncatedNormalFixture>["payload"]["cases"][number]

const toParams = (entry: TruncatedFixtureCase): TruncatedNormalParams => new TruncatedNormalParams(entry.params)

const numberAt = (valuesInput: Iterable<number>, index: number): number => {
  const values = Arr.fromIterable(valuesInput)
  return Arr.get(values, index).pipe(Option.getOrElse(() => Number.NaN))
}

const loadTruncatedFixture = loadFixture("truncated-normal.edge-cases").pipe(
  Effect.provide(FixtureRegistryLive),
  Effect.flatMap((fixture) => Schema.decodeUnknown(TruncatedNormalFixture)(fixture))
)

const firstParams = (
  fixture: Schema.Schema.Type<typeof TruncatedNormalFixture>
): Option.Option<TruncatedNormalParams> => Arr.head(fixture.payload.cases).pipe(Option.map(toParams))

const assertAbsoluteTolerance = (actual: number, expected: number, tolerance: number): void => {
  Match.value(expected).pipe(
    Match.when(
      (value) => Bool.not(Schema.is(Schema.NonNaN)(value)),
      () => expect(Bool.not(Schema.is(Schema.NonNaN)(actual))).toBe(true)
    ),
    Match.when((value) => Bool.not(Numeric.isFinite(value)), () => expect(actual).toBe(expected)),
    Match.orElse(() => expect(Numeric.abs(Num.subtract(actual, expected))).toBeLessThanOrEqual(tolerance))
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
            const preparedSample = prepareSample(params)

            yield* Effect.forEach(
              entry.sampleQuantiles,
              (quantile, index) =>
                Effect.sync(() => {
                  const actual = sample(quantile, params)
                  const expected = numberAt(entry.sampleExpected, index)

                  assertAbsoluteTolerance(actual, expected, SAMPLE_ABSOLUTE_TOLERANCE)
                  assertAbsoluteTolerance(preparedSample(quantile), expected, SAMPLE_ABSOLUTE_TOLERANCE)
                  expect(preparedSample(quantile)).toBe(actual)
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
            const preparedLogPdf = prepareLogPdf(params)

            yield* Effect.forEach(
              entry.logPdfProbes,
              (probe, index) =>
                Effect.sync(() => {
                  const actual = logPdf(probe, params)
                  const expected = numberAt(entry.logPdfExpected, index)

                  assertAbsoluteTolerance(actual, expected, LOG_PDF_ABSOLUTE_TOLERANCE)
                  assertAbsoluteTolerance(preparedLogPdf(probe), expected, LOG_PDF_ABSOLUTE_TOLERANCE)
                  expect(preparedLogPdf(probe)).toBe(actual)
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

            expect(Numeric.abs(Num.subtract(sample(0, params), params.low))).toBeLessThanOrEqual(
              SAMPLE_ABSOLUTE_TOLERANCE
            )
            expect(Numeric.abs(Num.subtract(sample(1, params), params.high))).toBeLessThanOrEqual(
              SAMPLE_ABSOLUTE_TOLERANCE
            )
            expect(Numeric.abs(Num.subtract(cdf(params.low, params), 0))).toBeLessThanOrEqual(
              CDF_ABSOLUTE_TOLERANCE
            )
            expect(Numeric.abs(Num.subtract(cdf(params.high, params), 1))).toBeLessThanOrEqual(
              CDF_ABSOLUTE_TOLERANCE
            )
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
        low: Num.negate(1),
        high: 1
      })

      yield* Effect.sync(() => {
        expect(Option.isSome(centeredParamsOption)).toBe(true)
      })

      const centeredParams = Option.getOrElse(centeredParamsOption, () => invalidParams)

      yield* Effect.sync(() => {
        expect(logPdf(Num.negate(0.1), centeredParams)).toBe(Number.NEGATIVE_INFINITY)
        expect(logPdf(1.1, centeredParams)).toBe(Number.NEGATIVE_INFINITY)

        expect(Bool.not(Schema.is(Schema.NonNaN)(logPdf(0, invalidParams)))).toBe(true)
        expect(Bool.not(Schema.is(Schema.NonNaN)(cdf(0, invalidParams)))).toBe(true)
        expect(Bool.not(Schema.is(Schema.NonNaN)(sample(0.5, invalidParams)))).toBe(true)
      })
    }))

  it.effect("prepared evaluators preserve exceptional rolls and collapsed or overflowed standardized bounds", () =>
    Effect.sync(() => {
      Arr.forEach(
        Arr.make(
          new TruncatedNormalParams({ mean: 1e20, sigma: 1, low: -1, high: 2 }),
          new TruncatedNormalParams({ mean: 0, sigma: 5e-324, low: -1, high: 2 }),
          new TruncatedNormalParams({ mean: 0, sigma: 1, low: 2, high: 2 })
        ),
        (params) => {
          const prepared = prepareSample(params)
          Arr.forEach(Arr.make(Number.NEGATIVE_INFINITY, -0.1, 0), (roll) => {
            expect(sample(roll, params)).toBe(params.low)
            expect(prepared(roll)).toBe(params.low)
          })
          Arr.forEach(Arr.make(1, 1.1, Number.POSITIVE_INFINITY), (roll) => {
            expect(sample(roll, params)).toBe(params.high)
            expect(prepared(roll)).toBe(params.high)
          })
          expect(prepared(Number.NaN)).toBeNaN()
          expect(prepared(0.4)).toBeNaN()
          expect(sample(0.4, params)).toBeNaN()
          expect(prepareLogPdf(params)(Number.NaN)).toBeNaN()
        }
      )
      Arr.forEach(Arr.make(0, -1, Number.NaN, Number.POSITIVE_INFINITY), (sigma) => {
        const params = new TruncatedNormalParams({ mean: 0, sigma, low: -1, high: 2 })
        const prepared = prepareSample(params)
        Arr.forEach(Arr.make(0, 0.4, 1, Number.NaN), (roll) => {
          expect(prepared(roll)).toBeNaN()
          expect(sample(roll, params)).toBeNaN()
        })
      })
    }))

  it.effect("provides typed error channels for invalid math inputs", () =>
    Effect.gen(function*() {
      const fixture = yield* loadTruncatedFixture
      const centeredParamsOption = firstParams(fixture)
      const invalidParams = new TruncatedNormalParams({
        mean: 0,
        sigma: 0,
        low: Num.negate(1),
        high: 1
      })
      const validParams = Option.getOrElse(centeredParamsOption, () => invalidParams)

      const invalidLogPdf = yield* Effect.either(logPdfEffect(0, invalidParams))
      const invalidCdf = yield* Effect.either(cdfEffect(0, invalidParams))
      const invalidSample = yield* Effect.either(sampleEffect(1.1, validParams))

      expect(Either.isLeft(invalidLogPdf)).toBe(true)
      expect(Either.isLeft(invalidCdf)).toBe(true)
      expect(Either.isLeft(invalidSample)).toBe(true)

      Either.mapLeft(invalidLogPdf, (failure) => expect(failure._tag).toBe("effect-search/InvalidMathInput"))
      Either.mapLeft(invalidCdf, (failure) => expect(failure._tag).toBe("effect-search/InvalidMathInput"))
      Either.mapLeft(invalidSample, (failure) => expect(failure._tag).toBe("effect-search/InvalidMathInput"))
    }))

  it.effect("effectful math matches pure outputs on valid inputs", () =>
    Effect.gen(function*() {
      const fixture = yield* loadTruncatedFixture
      const centeredParamsOption = firstParams(fixture)

      yield* Effect.sync(() => {
        expect(Option.isSome(centeredParamsOption)).toBe(true)
      })

      const centeredParams = Option.getOrElse(
        centeredParamsOption,
        () => new TruncatedNormalParams({ mean: 0, sigma: 1, low: 0, high: 1 })
      )

      const q = 0.37
      const x = 0.62
      const effectSample = yield* sampleEffect(q, centeredParams)
      const effectCdf = yield* cdfEffect(x, centeredParams)
      const effectLogPdf = yield* logPdfEffect(x, centeredParams)

      expect(Numeric.abs(Num.subtract(effectSample, sample(q, centeredParams)))).toBeLessThanOrEqual(
        SAMPLE_ABSOLUTE_TOLERANCE
      )
      expect(Numeric.abs(Num.subtract(effectCdf, cdf(x, centeredParams)))).toBeLessThanOrEqual(
        CDF_ABSOLUTE_TOLERANCE
      )
      expect(Numeric.abs(Num.subtract(effectLogPdf, logPdf(x, centeredParams)))).toBeLessThanOrEqual(
        LOG_PDF_ABSOLUTE_TOLERANCE
      )
    }))
})
