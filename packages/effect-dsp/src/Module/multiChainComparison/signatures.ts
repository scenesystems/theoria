/**
 * Internal signature construction for `Module.multiChainComparison`.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
import { Schema } from "effect"
import * as Signature from "../../Signature/index.js"

/**
 * Canonical field carrying the ordered candidate summary injected into the
 * final comparison pass.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
export const CANDIDATE_COMPARISONS_FIELD = "candidate_comparisons"

/**
 * Input fields projected into the final comparison pass.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
export type ComparisonInputFields<I extends Schema.Struct.Fields> = I & {
  readonly candidate_comparisons: typeof Schema.String
}

/**
 * Build the internal comparison signature consumed by the final verdict pass.
 *
 * @since 0.2.0
 * @category internal
 * @internal
 */
export const makeComparisonSignature = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields
>(options: {
  readonly candidateCount: number
  readonly signature: Signature.Signature<I, O>
}) =>
  Signature.make(
    `Compare ${options.candidateCount} candidate reasoning chains and return the best final answer.`,
    {
      ...options.signature.inputFields,
      [CANDIDATE_COMPARISONS_FIELD]: Signature.describe(
        Schema.String,
        "Ordered candidate reasoning summaries and predicted outputs"
      )
    },
    options.signature.outputFields
  )
