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
 * GEPA constructor options.
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
  readonly module: DspModule<I, O>
  readonly trainset: ReadonlyArray<Example>
  readonly valset?: ReadonlyArray<Example>
  readonly metric: Metric<ME, MR>
  readonly maxIterations: number
  readonly maxMergeInvocations?: number
  readonly seed?: number
}>

/**
 * GEPA event sink.
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
