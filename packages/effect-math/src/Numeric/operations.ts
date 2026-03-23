import { Effect, Schema } from "effect"

import { collectRuntimePolicies, RuntimePolicies } from "../contracts/shared/RuntimePolicies.js"
import {
  NumericBoundaryValidationInput,
  NumericBoundaryValidationResult,
  NumericDomainBoundaryError
} from "./errors.js"
import { NumericDomainModel } from "./model.js"

/**
 * Numeric operation scaffold.
 *
 * @since 0.1.0
 * @category operations
 */
export const loadNumericDomain = Effect.succeed(NumericDomainModel)

/**
 * Validates numeric boundary payloads with runtime policy seams wired.
 *
 * @since 0.1.0
 * @category operations
 */
export const validateNumericBoundary = (input: unknown) =>
  Effect.gen(function*() {
    const runtimePolicies = yield* collectRuntimePolicies

    yield* Effect.catchAll(
      Schema.decodeUnknown(RuntimePolicies)(runtimePolicies, {
        onExcessProperty: "error"
      }),
      (error) =>
        Effect.fail(
          new NumericDomainBoundaryError({
            message: error.message
          })
        )
    )

    yield* Effect.catchAll(
      Schema.decodeUnknown(NumericBoundaryValidationInput)(input),
      (error) =>
        Effect.fail(
          new NumericDomainBoundaryError({
            message: error.message
          })
        )
    )

    return yield* Effect.catchAll(
      Schema.decodeUnknown(NumericBoundaryValidationResult)({
        ok: true
      }),
      (error) =>
        Effect.fail(
          new NumericDomainBoundaryError({
            message: error.message
          })
        )
    )
  })
