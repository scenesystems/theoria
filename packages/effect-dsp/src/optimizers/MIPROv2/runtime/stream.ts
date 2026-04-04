/**
 * MIPROv2 event stream projection via the shared emitter bridge.
 *
 * @since 0.1.0
 * @internal
 */
import type { Effect, Stream } from "effect"
import { streamFromEmitter } from "effect-search/Study"
import type { MIPROv2Event as MIPROv2EventType } from "../events.js"
import type { Phase3EventSink } from "../phase3-model.js"

/**
 * Converts an effectful MIPROv2 computation that emits events via a
 * callback sink into a lazy `Stream` of those events.
 *
 * The caller supplies a function that receives an `emit` callback and
 * returns an `Effect` performing the optimization work. Each call to
 * `emit` pushes an event into the resulting stream, allowing consumers
 * to observe progress incrementally.
 *
 * @since 0.1.0
 * @category events
 */
export const streamMIPROv2Events = <A, E, R>(
  runWithEvents: (emit: Phase3EventSink) => Effect.Effect<A, E, R>
): Stream.Stream<MIPROv2EventType, E, R> => streamFromEmitter(runWithEvents)
