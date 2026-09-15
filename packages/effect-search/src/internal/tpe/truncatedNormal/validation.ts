import { Boolean, Effect, Equal, Number as Num, Schema } from "effect"

import { InvalidMathInput } from "../../../Errors/index.js"
import type { TruncatedNormalParams } from "./model.js"

const isFinite = Schema.is(Schema.Finite)
const isNonNaN = Schema.is(Schema.NonNaN)

const positive = (value: number): boolean => Boolean.and(isNonNaN(value), Num.greaterThan(value, 0))

const lessThanOrEqualTo = (left: number, right: number): boolean =>
  Boolean.and(
    Boolean.and(isNonNaN(left), isNonNaN(right)),
    Num.lessThanOrEqualTo(left, right)
  )

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
    yield* failWhen(Boolean.not(isFinite(params.mean)), operation, "mean must be finite")
    yield* failWhen(Boolean.not(isFinite(params.sigma)), operation, "sigma must be finite")
    yield* failWhen(Boolean.not(isFinite(params.low)), operation, "low must be finite")
    yield* failWhen(Boolean.not(isFinite(params.high)), operation, "high must be finite")
    yield* failWhen(Boolean.not(positive(params.sigma)), operation, "sigma must be > 0")
    yield* failWhen(Boolean.not(lessThanOrEqualTo(params.low, params.high)), operation, "low must be <= high")
    yield* failWhen(Equal.equals(params.low, params.high), operation, "low and high must not be equal")
  })

export const isValidParams = (params: TruncatedNormalParams): boolean =>
  Boolean.and(
    Boolean.and(
      Boolean.and(isFinite(params.mean), isFinite(params.sigma)),
      Boolean.and(isFinite(params.low), isFinite(params.high))
    ),
    Boolean.and(positive(params.sigma), lessThanOrEqualTo(params.low, params.high))
  )
