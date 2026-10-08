import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Boolean as Bool, Effect, Match, Number as Num, Option, Result, Schema } from "effect"

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
import { prepareLogPdf } from "../../../src/internal/tpe/truncatedNormal/truncated.js"
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
  Effect.flatMap((fixture) => Schema.decodeUnknownEffect(TruncatedNormalFixture)(fixture))
)

const firstParams = (
  fixture: Schema.Schema.Type<typeof TruncatedNormalFixture>
): Option.Option<TruncatedNormalParams> => Arr.head(fixture.payload.cases).pipe(Option.map(toParams))

const assertAbsoluteTolerance = (actual: number, expected: number, tolerance: number): void => {
  Match.value(expected).pipe(
    Match.when(
      (value) => Bool.not(Schema.is(Schema.Finite)(value)),
      () => expect(Bool.not(Schema.is(Schema.Finite)(actual))).toBe(true)
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

  it.effect("inverts upstream quantiles with cdf within absolute tolerance 1e-12", () =>
    Effect.gen(function*() {
      const fixture = yield* loadTruncatedFixture

      yield* Effect.forEach(
        fixture.payload.cases,
        (entry) =>
          Effect.gen(function*() {
            const params = toParams(entry)

            yield* Effect.forEach(
              entry.sampleExpected,
              (probe, index) =>
                Effect.sync(() => {
                  const actual = cdf(probe, params)
                  const expected = numberAt(entry.sampleQuantiles, index)

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
        low: Num.multiply(-1, 1),
        high: 1
      })

      yield* Effect.sync(() => {
        expect(Option.isSome(centeredParamsOption)).toBe(true)
      })

      const centeredParams = Option.getOrElse(centeredParamsOption, () => invalidParams)

      yield* Effect.sync(() => {
        expect(logPdf(Num.multiply(-1, 0.1), centeredParams)).toBe(Number.NEGATIVE_INFINITY)
        expect(logPdf(1.1, centeredParams)).toBe(Number.NEGATIVE_INFINITY)

        expect(Bool.not(Schema.is(Schema.Finite)(logPdf(0, invalidParams)))).toBe(true)
        expect(Bool.not(Schema.is(Schema.Finite)(cdf(0, invalidParams)))).toBe(true)
        expect(Bool.not(Schema.is(Schema.Finite)(sample(0.5, invalidParams)))).toBe(true)
      })
    }))

  it.effect("provides typed error channels for invalid math inputs", () =>
    Effect.gen(function*() {
      const fixture = yield* loadTruncatedFixture
      const centeredParamsOption = firstParams(fixture)
      const invalidParams = new TruncatedNormalParams({
        mean: 0,
        sigma: 0,
        low: Num.multiply(-1, 1),
        high: 1
      })
      const validParams = Option.getOrElse(centeredParamsOption, () => invalidParams)

      const invalidLogPdf = yield* Effect.result(logPdfEffect(0, invalidParams))
      const invalidCdf = yield* Effect.result(cdfEffect(0, invalidParams))
      const invalidSample = yield* Effect.result(sampleEffect(1.1, validParams))

      expect(Result.isFailure(invalidLogPdf)).toBe(true)
      expect(Result.isFailure(invalidCdf)).toBe(true)
      expect(Result.isFailure(invalidSample)).toBe(true)

      Result.mapError(invalidLogPdf, (failure) => expect(failure._tag).toBe("effect-search/InvalidMathInput"))
      Result.mapError(invalidCdf, (failure) => expect(failure._tag).toBe("effect-search/InvalidMathInput"))
      Result.mapError(invalidSample, (failure) => expect(failure._tag).toBe("effect-search/InvalidMathInput"))
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
