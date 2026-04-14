/**
 * COPRO public option and sink models.
 *
 * @since 0.2.0
 */
import { Effect } from "effect"
import type { Schema } from "effect"
import type { Example } from "../../Example/index.js"
import type { Metric } from "../../Metric/model.js"
import type { Module as DspModule } from "../../Module/model.js"
import type { COPROEvent as COPROEventType } from "./events.js"
import type { COPROSnapshot } from "./snapshot.js"

/**
 * Configuration for COPRO instruction optimization.
 *
 * @since 0.2.0
 * @category models
 */
export type COPROOptions<I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME = never, MR = never> =
  Readonly<{
    readonly module: DspModule<I, O>
    readonly trainset: ReadonlyArray<Example>
    readonly valset?: ReadonlyArray<Example>
    readonly metric: Metric<ME, MR>
    readonly numCandidates: number
    readonly maxSteps: number
    readonly seed?: number
    readonly initTemperature?: number
    readonly resumeFrom?: COPROSnapshot
    readonly snapshotSink?: (snapshot: COPROSnapshot) => Effect.Effect<void>
  }>

/**
 * Callback invoked with each COPRO lifecycle event.
 *
 * @since 0.2.0
 * @category models
 */
export type COPROEventSink = (event: COPROEventType) => Effect.Effect<void>

/**
 * No-op event sink that discards all COPRO events.
 *
 * @since 0.2.0
 * @category constants
 */
export const noCOPROEvents: COPROEventSink = () => Effect.void
