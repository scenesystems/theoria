/**
 * GEPA event-stream runtime adapter.
 *
 * @since 0.0.0
 */
import type { Effect, Stream } from "effect"
import { streamFromEmitter } from "effect-search/Study"

import type { GEPAEvent as GEPAEventType } from "../events.js"

import type { GEPAEventSink } from "./options.js"

/**
 * Stream GEPA optimizer events with deterministic ordering and terminal signaling.
 *
 * @since 0.0.0
 * @category constructors
 */
export const streamGEPAEvents = <A, E, R>(
  runWithEvents: (emit: GEPAEventSink) => Effect.Effect<A, E, R>
): Stream.Stream<GEPAEventType, E, R> => streamFromEmitter(runWithEvents)
