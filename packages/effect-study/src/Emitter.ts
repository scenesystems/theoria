/**
 * Scoped callback-style event producers as Effect streams.
 *
 * @since 0.1.0
 * @module
 */
import { Effect, Mailbox, Stream } from "effect"

/**
 * Emits one value from a producer into its stream.
 *
 * @typeParam A - Value passed from the producer into the stream.
 *
 * @since 0.1.0
 * @category models
 */
export type Emitter<A> = (value: A) => Effect.Effect<void>

/**
 * Runs a producer in a scoped fiber and emits its values in call order.
 *
 * The stream ends after successful producer completion. A producer failure or
 * defect is delivered after values emitted before it. Ending or interrupting
 * stream consumption interrupts the producer and waits for its finalizers.
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
  Stream.unwrapScoped(
    Effect.gen(function*() {
      const mailbox = yield* Mailbox.make<A, E>()
      yield* Effect.addFinalizer(() => mailbox.shutdown)
      yield* Effect.suspend(() => self((value) => mailbox.offer(value).pipe(Effect.asVoid))).pipe(
        Mailbox.into(mailbox),
        Effect.forkScoped
      )
      return Mailbox.toStream(mailbox)
    })
  )
