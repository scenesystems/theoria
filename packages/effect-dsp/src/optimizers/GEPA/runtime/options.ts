/**
 * Defines GEPA inputs, iteration limits, deterministic seed, and event sink.
 *
 * @since 0.1.0
 */
import { Data, Effect } from "effect"
import type { Schema } from "effect"

import type { Example } from "../../../Example/index.js"
import type { Metric } from "../../../Metric/model.js"
import type { Module as DspModule } from "../../../Module/model.js"

import type { GEPAEvent as GEPAEventType } from "../events.js"

/**
 * Configures candidate evaluation, reflective mutation, and merge attempts.
 *
 * @typeParam I - Input fields accepted by the optimized module.
 * @typeParam O - Output fields scored during candidate evaluation.
 * @typeParam ME - Expected failure from the configured metric.
 * @typeParam MR - Services required by the configured metric.
 *
 * @since 0.1.0
 * @category models
 */
export class GEPAOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
> extends Data.Class<{
  /** Module whose instructions are replaced by the selected frontier candidate. */
  readonly module: DspModule<I, O>
  /** Default validation examples when `valset` is omitted. */
  readonly trainset: ReadonlyArray<Example>
  /** Candidate evaluation and reflection examples. Defaults to `trainset`; rows without `output` are ignored. */
  readonly valset?: ReadonlyArray<Example>
  /** Scores each prediction and may supply feedback for the next mutation prompt. */
  readonly metric: Metric<ME, MR>
  /** Iteration count, rounded down; negative and non-finite values become zero. */
  readonly maxIterations: number
  /** Merge budget, rounded down and normalized like `maxIterations`; defaults to `5`. */
  readonly maxMergeInvocations?: number
  /** Seed for deterministic parent selection and subsampling. Defaults to `1`. */
  readonly seed?: number
}> {}

/**
 * Receives each event before GEPA advances to the next lifecycle step.
 *
 * @remarks
 * The sink cannot add failures or service requirements. Use
 * {@link tapGEPAProgress} on {@link gepaStream} for effectful observation with
 * either channel.
 *
 * @since 0.1.0
 * @category models
 */
export type GEPAEventSink = (event: GEPAEventType) => Effect.Effect<void>

/**
 * Discards GEPA events without adding effects or service requirements.
 *
 * @since 0.1.0
 * @category constants
 */
export const noGEPAEvents: GEPAEventSink = () => Effect.void

/**
 * Limits accepted common-ancestor merges to five when no budget is supplied.
 *
 * @since 0.1.0
 * @category constants
 */
export const DEFAULT_MAX_MERGE_INVOCATIONS = 5
