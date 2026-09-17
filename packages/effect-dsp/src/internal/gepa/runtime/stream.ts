/**
 * GEPA event-stream runtime adapter.
 *
 * @since 0.1.0
 */
import * as Emitter from "@scenesystems/effect-study/Emitter"
import type { Effect, Stream } from "effect"

import type { Event, EventSink } from "../../../GEPA.js"

/**
 * Stream GEPA optimizer events with deterministic ordering and terminal signaling.
 *
 * @since 0.1.0
 * @category constructors
 */
export const streamGEPAEvents = <A, E, R>(
  runWithEvents: (emit: EventSink) => Effect.Effect<A, E, R>
): Stream.Stream<Event, E, R> => Emitter.toStream(runWithEvents)
