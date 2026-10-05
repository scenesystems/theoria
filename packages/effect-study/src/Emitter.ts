/**
 * Scoped callback-style event producers as Effect streams.
 *
 * @since 0.1.0
 * @module
 */
import type { Cause } from "effect"
import { Effect, Queue, Stream } from "effect"

/**
 * Observes one value, acknowledging it when the returned Effect succeeds.
 * The observer owns the meaning of acknowledgment and its error/service channels.
 *
 * @typeParam A - Value passed from the producer into the stream.
 *
 * @since 0.1.0
 * @category models
 */
export type Emitter<A, E = never, R = never> = (value: A) => Effect.Effect<void, E, R>

/**
 * Runs a producer in a scoped fiber and emits its values in call order.
 *
 * The stream ends after successful producer completion. A producer failure or
 * defect is delivered after values emitted before it. Ending or interrupting
 * stream consumption interrupts the producer and waits for its finalizers.
 * Queue insertion acknowledges memory acceptance, not consumer processing or
 * persistence. This unbounded bridge does not impose sink backpressure.
 *
 * @typeParam A - Value emitted by the producer and yielded by the stream.
 * @typeParam Done - Producer success value, discarded when the stream completes.
 * @typeParam E - Expected failure propagated from the producer to the stream.
 * @typeParam R - Services required while the producer fiber runs.
 *
 * @since 0.1.0
 * @category conversions
 */
export const toStream = <A, Done, E, R>(
  self: (emitter: Emitter<A>) => Effect.Effect<Done, E, R>
): Stream.Stream<A, E, R> =>
  Stream.unwrap(
    Effect.gen(function*() {
      const queue = yield* Queue.make<A, E | Cause.Done>()
      yield* Effect.addFinalizer(() => Queue.shutdown(queue))
      yield* Effect.suspend(() => self((value) => Queue.offer(queue, value).pipe(Effect.asVoid))).pipe(
        Queue.into(queue),
        Effect.forkScoped
      )
      return Stream.fromQueue(queue)
    })
  )
