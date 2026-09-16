import { Boolean as Bool, Effect, Equal, Number as Num } from "effect"

import { InvalidMathInput } from "../../../SearchError.js"
import type { TruncatedNormalParams } from "../truncatedNormal.js"

const invalidMathInput = (operation: string, reason: string): InvalidMathInput =>
  new InvalidMathInput({
    operation,
    reason
  })

export const failWhen = (
  condition: boolean,
  operation: string,
  reason: string
): Effect.Effect<void, InvalidMathInput> =>
  Effect.when(Effect.fail(invalidMathInput(operation, reason)), () => condition)

export const ensureCommonParams = (
  operation: string,
  params: TruncatedNormalParams
): Effect.Effect<void, InvalidMathInput> =>
  Effect.gen(function*() {
    yield* failWhen(Bool.not(Number.isFinite(params.mean)), operation, "mean must be finite")
    yield* failWhen(Bool.not(Number.isFinite(params.sigma)), operation, "sigma must be finite")
    yield* failWhen(Bool.not(Number.isFinite(params.low)), operation, "low must be finite")
    yield* failWhen(Bool.not(Number.isFinite(params.high)), operation, "high must be finite")
    yield* failWhen(Num.lessThanOrEqualTo(params.sigma, 0), operation, "sigma must be > 0")
    yield* failWhen(Num.greaterThan(params.low, params.high), operation, "low must be <= high")
    yield* failWhen(Equal.equals(params.low, params.high), operation, "low and high must not be equal")
  })

export const isValidParams = (params: TruncatedNormalParams): boolean =>
  Bool.and(
    Bool.and(
      Bool.and(Number.isFinite(params.mean), Number.isFinite(params.sigma)),
      Bool.and(Number.isFinite(params.low), Number.isFinite(params.high))
    ),
    Bool.and(Num.greaterThan(params.sigma, 0), Num.lessThanOrEqualTo(params.low, params.high))
  )
