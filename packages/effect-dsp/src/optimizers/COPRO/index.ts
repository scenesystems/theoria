/**
 * COPRO optimizer — coordinate-ascent instruction refinement with typed
 * progress events, resumable step-boundary snapshots, and effect-search-
 * compatible study projections for downstream storage and visualization.
 *
 * @since 0.2.0
 */
import type { Schema } from "effect"
import { streamFromEmitter } from "effect-search/Study"
import type { COPROEventSink, COPROOptions } from "./model.js"
import { noCOPROEvents } from "./model.js"
import { runCOPRO } from "./runtime/run.js"

/**
 * Run COPRO with an explicit event sink.
 *
 * Use this when a caller needs deterministic progress handling while still
 * consuming the native COPRO runtime rather than a second study engine.
 *
 * @since 0.2.0
 * @category constructors
 */
export const coproWithEvents = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME = never, MR = never>(
  options: COPROOptions<I, O, ME, MR>,
  emit: COPROEventSink
) => runCOPRO(options, emit)

/**
 * Run COPRO and return the optimized module.
 *
 * Snapshot and study-envelope helpers on this module keep the runtime aligned
 * with existing effect-search artifact and replay surfaces.
 *
 * @since 0.2.0
 * @category constructors
 */
export const copro = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME = never, MR = never>(
  options: COPROOptions<I, O, ME, MR>
) => coproWithEvents(options, noCOPROEvents)

/**
 * Run COPRO and project all lifecycle events as an Effect stream using the
 * same emitter bridge consumed by effect-search study streams.
 *
 * @since 0.2.0
 * @category constructors
 */
export const coproStream = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME = never, MR = never>(
  options: COPROOptions<I, O, ME, MR>
) => streamFromEmitter((eventSink) => coproWithEvents(options, eventSink))

export * from "./events.js"
export * from "./model.js"
export * from "./progress.js"
export * from "./snapshot.js"
