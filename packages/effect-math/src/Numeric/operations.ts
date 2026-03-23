import { Effect, Schema } from "effect"

import {
  BackendPolicyService,
  DiagnosticsPolicyService,
  PrecisionPolicyService,
  RngPolicyService
} from "../contracts/shared/RuntimePolicies.js"
import { NumericBoundaryValidationInput, NumericDomainBoundaryError } from "./errors.js"
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
    yield* RngPolicyService
    yield* PrecisionPolicyService
    yield* BackendPolicyService
    yield* DiagnosticsPolicyService

    yield* Effect.catchAll(
      Schema.decodeUnknown(NumericBoundaryValidationInput)(input),
      (error) =>
        Effect.fail(
          new NumericDomainBoundaryError({
            message: error.message
          })
        )
    )

    return {
      ok: true
    }
  })
