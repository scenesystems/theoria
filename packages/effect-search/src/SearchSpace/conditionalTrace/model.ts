/**
 * Data models for conditional trace analysis including trial records, partitions, and dimension groups.
 *
 * @since 0.1.0
 */
import { Data } from "effect"

import type { PrimitiveChoice } from "../../contracts/Distribution.js"

/**
 * A trial number and primitive parameters used to analyze conditional activation.
 *
 * @since 0.1.0
 * @category models
 */
export class ConditionalTraceTrial extends Data.Class<{
  readonly trialNumber: number
  readonly params: Record<string, PrimitiveChoice>
}> {}

/**
 * Trial indices partitioned by whether a conditional branch was active.
 *
 * @since 0.1.0
 * @category models
 */
export class ConditionalTracePartition extends Data.Class<{
  readonly included: ReadonlyArray<number>
  readonly excluded: ReadonlyArray<number>
}> {}

/**
 * Search-space dimensions sharing the same conditional activation trace.
 *
 * @since 0.1.0
 * @category models
 */
export class ConditionalGroup extends Data.Class<{
  readonly key: string
  readonly dimensions: ReadonlyArray<string>
}> {}
