/**
 * MIPROv2 event stream projection via the shared emitter bridge.
 *
 * @since 0.1.0
 * @internal
 */
import * as Emitter from "@scenesystems/effect-study/Emitter"
import type { Effect, Stream } from "effect"
import type { Event } from "../../../MIPROv2.js"
import type { EventSink } from "../../../MIPROv2Search.js"

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
  runWithEvents: (emit: EventSink) => Effect.Effect<A, E, R>
): Stream.Stream<Event, E, R> => Emitter.toStream(runWithEvents)
