import { Schema } from "effect"

import type { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { AbsoluteTolerance, IterationBudget } from "../contracts/shared/BrandedScalars.js"

/**
 * Numeric boundary failure scaffold.
 *
 * @since 0.1.0
 * @category errors
 */
export class NumericDomainBoundaryError
  extends Schema.TaggedError<NumericDomainBoundaryError>()("NumericDomainBoundaryError", {
    message: Schema.String
  })
{}

/**
 * Numeric boundary validation input contract.
 *
 * @since 0.1.0
 * @category contracts
 */
export const NumericBoundaryValidationInput = Schema.Struct({
  values: Schema.Array(Schema.Number.pipe(Schema.finite())),
  tolerance: AbsoluteTolerance,
  budget: IterationBudget
})

/**
 * Numeric boundary validation result contract.
 *
 * @since 0.1.0
 * @category models
 */
export const NumericBoundaryValidationResult = Schema.Struct({
  ok: Schema.Boolean
})

/**
 * Numeric operation boundary errors.
 *
 * @since 0.1.0
 * @category errors
 */
export type NumericBoundaryError = NumericDomainBoundaryError | BoundaryDecodeError | BoundaryEncodeError
