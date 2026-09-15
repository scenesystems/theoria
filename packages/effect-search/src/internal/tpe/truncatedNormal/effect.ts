import { Boolean, Effect, Number as Num, Schema } from "effect"

import type { InvalidMathInput } from "../../../Errors/index.js"
import type { TruncatedNormalParams } from "./model.js"
import { cdf, logPdf, sample } from "./truncated.js"
import { ensureCommonParams, failWhen } from "./validation.js"

const isFinite = Schema.is(Schema.Finite)
const isNonNaN = Schema.is(Schema.NonNaN)

const isNaN = (value: number): boolean => Boolean.not(isNonNaN(value))

const outsideUnitInterval = (value: number): boolean =>
  Boolean.or(
    Boolean.and(isNonNaN(value), Num.lessThan(value, 0)),
    Boolean.and(isNonNaN(value), Num.greaterThan(value, 1))
  )

export const logPdfEffect = (x: number, params: TruncatedNormalParams): Effect.Effect<number, InvalidMathInput> =>
  Effect.gen(function*() {
    yield* ensureCommonParams("logPdf", params)
    yield* failWhen(isNaN(x), "logPdf", "x must not be NaN")

    const value = logPdf(x, params)

    yield* failWhen(isNaN(value), "logPdf", "result must not be NaN")
    return value
  })

export const cdfEffect = (x: number, params: TruncatedNormalParams): Effect.Effect<number, InvalidMathInput> =>
  Effect.gen(function*() {
    yield* ensureCommonParams("cdf", params)
    yield* failWhen(isNaN(x), "cdf", "x must not be NaN")

    const value = cdf(x, params)

    yield* failWhen(isNaN(value), "cdf", "result must not be NaN")
    return value
  })

export const sampleEffect = (random: number, params: TruncatedNormalParams): Effect.Effect<number, InvalidMathInput> =>
  Effect.gen(function*() {
    yield* ensureCommonParams("sample", params)
    yield* failWhen(Boolean.not(isFinite(random)), "sample", "quantile must be finite")
    yield* failWhen(outsideUnitInterval(random), "sample", "quantile must be in [0, 1]")

    const value = sample(random, params)

    yield* failWhen(isNaN(value), "sample", "result must not be NaN")
    return value
  })
