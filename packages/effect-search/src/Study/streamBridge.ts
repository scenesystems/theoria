/**
 * Converts callback-style event producers into Effect streams.
 *
 * @since 0.1.0
 */
import { Effect, Stream } from "effect"

/**
 * Enqueues one event for a stream created by {@link streamFromEmitter}.
 *
 * @typeParam Emitted - Value passed from the producer into the stream.
 *
 * @since 0.1.0
 * @category models
 */
export type EmitterSink<Emitted> = (event: Emitted) => Effect.Effect<void, never, never>

/**
 * Runs an event producer in a scoped fiber and emits its events in call order.
 *
 * @remarks
 * The stream ends after successful producer completion. A producer failure is
 * delivered after events emitted before that failure. Ending or interrupting
 * stream consumption closes the scope containing the producer fiber.
 *
 * @typeParam Emitted - Value emitted by the producer and yielded by the stream.
 * @typeParam A - Producer success value, discarded when the stream completes.
 * @typeParam E - Expected failure propagated from the producer to the stream.
 * @typeParam R - Services required while the producer fiber runs.
 *
 * @since 0.1.0
 * @category combinators
 */
export const streamFromEmitter = <Emitted, A, E, R>(
  runWithEmitter: (emit: EmitterSink<Emitted>) => Effect.Effect<A, E, R>
): Stream.Stream<Emitted, E, R> =>
  Stream.asyncPush<Emitted, E, R>((emit) =>
    runWithEmitter((event) =>
      Effect.sync(() => {
        emit.single(event)
      })
    ).pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          Effect.sync(() => {
            emit.fail(error)
          }),
        onSuccess: () =>
          Effect.sync(() => {
            emit.end()
          })
      })
    ).pipe(Effect.forkScoped)
  )
