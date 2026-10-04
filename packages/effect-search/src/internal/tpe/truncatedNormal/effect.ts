import { isFinite } from "@scenesystems/effect-math/Numeric"
import { Boolean as Bool, Effect, Equal, Number as Num } from "effect"

import type { InvalidMathInput } from "../../../SearchError.js"
import type { TruncatedNormalParams } from "../truncatedNormal.js"
import { cdf, logPdf, sample } from "./truncated.js"
import { ensureCommonParams, failWhen } from "./validation.js"

export const logPdfEffect = (x: number, params: TruncatedNormalParams): Effect.Effect<number, InvalidMathInput> =>
  Effect.gen(function*() {
    yield* ensureCommonParams("logPdf", params)
    yield* failWhen(Equal.equals(x, Number.NaN), "logPdf", "x must not be NaN")

    const value = logPdf(x, params)

    yield* failWhen(Equal.equals(value, Number.NaN), "logPdf", "result must not be NaN")
    return value
  })

export const cdfEffect = (x: number, params: TruncatedNormalParams): Effect.Effect<number, InvalidMathInput> =>
  Effect.gen(function*() {
    yield* ensureCommonParams("cdf", params)
    yield* failWhen(Equal.equals(x, Number.NaN), "cdf", "x must not be NaN")

    const value = cdf(x, params)

    yield* failWhen(Equal.equals(value, Number.NaN), "cdf", "result must not be NaN")
    return value
  })

export const sampleEffect = (random: number, params: TruncatedNormalParams): Effect.Effect<number, InvalidMathInput> =>
  Effect.gen(function*() {
    yield* ensureCommonParams("sample", params)
    yield* failWhen(Bool.not(isFinite(random)), "sample", "quantile must be finite")
    yield* failWhen(
      Bool.or(Num.isLessThan(random, 0), Num.isGreaterThan(random, 1)),
      "sample",
      "quantile must be in [0, 1]"
    )

    const value = sample(random, params)

    yield* failWhen(Equal.equals(value, Number.NaN), "sample", "result must not be NaN")
    return value
  })
