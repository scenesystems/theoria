import { isFinite } from "@scenesystems/effect-math/Numeric"
import { Boolean as Bool, Effect, Number as Num, Predicate, Schema } from "effect"

import type { InvalidMathInput } from "../../../SearchError.js"
import type { TruncatedNormalParams } from "../truncatedNormal.js"
import { cdf, logPdf, sample } from "./truncated.js"
import { ensureCommonParams, failWhen } from "./validation.js"

export const logPdfEffect = (x: number, params: TruncatedNormalParams): Effect.Effect<number, InvalidMathInput> =>
  Effect.gen(function*() {
    yield* ensureCommonParams("logPdf", params)
    yield* failWhen(Predicate.not(Schema.is(Schema.NonNaN))(x), "logPdf", "x must not be NaN")

    const value = logPdf(x, params)

    yield* failWhen(Predicate.not(Schema.is(Schema.NonNaN))(value), "logPdf", "result must not be NaN")
    return value
  })

export const cdfEffect = (x: number, params: TruncatedNormalParams): Effect.Effect<number, InvalidMathInput> =>
  Effect.gen(function*() {
    yield* ensureCommonParams("cdf", params)
    yield* failWhen(Predicate.not(Schema.is(Schema.NonNaN))(x), "cdf", "x must not be NaN")

    const value = cdf(x, params)

    yield* failWhen(Predicate.not(Schema.is(Schema.NonNaN))(value), "cdf", "result must not be NaN")
    return value
  })

export const sampleEffect = (random: number, params: TruncatedNormalParams): Effect.Effect<number, InvalidMathInput> =>
  Effect.gen(function*() {
    yield* ensureCommonParams("sample", params)
    yield* failWhen(Bool.not(isFinite(random)), "sample", "quantile must be finite")
    yield* failWhen(
      Bool.or(Num.lessThan(random, 0), Num.greaterThan(random, 1)),
      "sample",
      "quantile must be in [0, 1]"
    )

    const value = sample(random, params)

    yield* failWhen(Predicate.not(Schema.is(Schema.NonNaN))(value), "sample", "result must not be NaN")
    return value
  })
