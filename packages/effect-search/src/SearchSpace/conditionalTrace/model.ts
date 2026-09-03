/**
 * Inputs and results for conditional activation analysis.
 *
 * @since 0.1.0
 */
import { Data } from "effect"

import type { PrimitiveChoice } from "../../contracts/Distribution.js"

/**
 * Supplies one primitive configuration for conditional activation analysis.
 *
 * @since 0.1.0
 * @category models
 */
export class ConditionalTraceTrial extends Data.Class<{
  /** Trial identity copied into partition results. */
  readonly trialNumber: number
  /** Primitive parameter values used for presence and condition checks. */
  readonly params: Record<string, PrimitiveChoice>
}> {}

/**
 * Separates trial identities by required-parameter availability and activation.
 *
 * @since 0.1.0
 * @category models
 */
export class ConditionalTracePartition extends Data.Class<{
  /** Trial identities that contain every active required parameter. */
  readonly included: ReadonlyArray<number>
  /** Trial identities missing a parameter or failing an activation condition. */
  readonly excluded: ReadonlyArray<number>
}> {}

/**
 * Names dimensions that belong to one independently sampled conditional group.
 *
 * @since 0.1.0
 * @category models
 */
export class ConditionalGroup extends Data.Class<{
  /** Lexicographically joined dimension names separated by `"|"`. */
  readonly key: string
  /** Unique dimension names in lexical order. */
  readonly dimensions: ReadonlyArray<string>
}> {}
