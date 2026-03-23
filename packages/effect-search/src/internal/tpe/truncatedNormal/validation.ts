import { Effect } from "effect"

import { InvalidMathInput } from "../../../Errors/index.js"
import type { TruncatedNormalParams } from "./model.js"

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
    yield* failWhen(!Number.isFinite(params.mean), operation, "mean must be finite")
    yield* failWhen(!Number.isFinite(params.sigma), operation, "sigma must be finite")
    yield* failWhen(!Number.isFinite(params.low), operation, "low must be finite")
    yield* failWhen(!Number.isFinite(params.high), operation, "high must be finite")
    yield* failWhen(params.sigma <= 0, operation, "sigma must be > 0")
    yield* failWhen(params.low > params.high, operation, "low must be <= high")
    yield* failWhen(params.low === params.high, operation, "low and high must not be equal")
  })

export const isValidParams = (params: TruncatedNormalParams): boolean =>
  Number.isFinite(params.mean) &&
  Number.isFinite(params.sigma) &&
  Number.isFinite(params.low) &&
  Number.isFinite(params.high) &&
  params.sigma > 0 &&
  params.low <= params.high
