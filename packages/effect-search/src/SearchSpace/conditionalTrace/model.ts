/**
 * Data models for conditional trace analysis including trial records, partitions, and dimension groups.
 *
 * @since 0.1.0
 */
import { Data } from "effect"

import type { PrimitiveChoice } from "../../contracts/Distribution.js"

/**
 * @since 0.1.0
 * @category models
 */
export class ConditionalTraceTrial extends Data.Class<{
  readonly trialNumber: number
  readonly params: Record<string, PrimitiveChoice>
}> {}

/**
 * @since 0.1.0
 * @category models
 */
export class ConditionalTracePartition extends Data.Class<{
  readonly included: ReadonlyArray<number>
  readonly excluded: ReadonlyArray<number>
}> {}

/**
 * @since 0.1.0
 * @category models
 */
export class ConditionalGroup extends Data.Class<{
  readonly key: string
  readonly dimensions: ReadonlyArray<string>
}> {}
