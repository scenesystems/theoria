/**
 * GEPA runtime option and sink contracts.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"
import type { Schema } from "effect"

import type { Example } from "../../../Example/index.js"
import type { Metric } from "../../../Metric/model.js"
import type { Module as DspModule } from "../../../Module/model.js"

import type { GEPAEvent as GEPAEventType } from "../events.js"

/**
 * GEPA orchestration options. The implementation evaluates the initial
 * candidate, then performs merge and mutation phases in iteration order.
 *
 * @since 0.1.0
 * @category models
 */
export type GEPAOptions<
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  ME = never,
  MR = never
> = Readonly<{
  /** Module whose instructions are replaced by the selected frontier candidate. */
  readonly module: DspModule<I, O>
  /** Examples used to construct reflective mutation feedback. */
  readonly trainset: ReadonlyArray<Example>
  /** Candidate evaluation examples. Defaults to `trainset`. */
  readonly valset?: ReadonlyArray<Example>
  /** Produces per-example scores and optional reflection feedback. */
  readonly metric: Metric<ME, MR>
  /** Number of evolutionary iterations, truncated with a lower bound of zero. */
  readonly maxIterations: number
  /** Total merge attempts allowed across the run. Defaults to `5`. */
  readonly maxMergeInvocations?: number
  /** Seed for deterministic parent selection and subsampling. Defaults to `1`. */
  readonly seed?: number
}>

/**
 * Event sink awaited before GEPA advances to the next lifecycle step. Sink
 * failures are `never`; use Stream combinators to add fallible observation.
 *
 * @since 0.1.0
 * @category models
 */
export type GEPAEventSink = (event: GEPAEventType) => Effect.Effect<void>

/**
 * No-op GEPA event sink used by non-streaming execution.
 *
 * @since 0.1.0
 * @category constants
 */
export const noGEPAEvents: GEPAEventSink = () => Effect.void

/**
 * Default merge budget for GEPA orchestration.
 *
 * @since 0.1.0
 * @category constants
 */
export const DEFAULT_MAX_MERGE_INVOCATIONS = 5
