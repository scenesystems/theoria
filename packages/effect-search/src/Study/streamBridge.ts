/**
 * Generic event-stream bridge for optimizer runtimes.
 *
 * @since 0.1.0
 */
import { Effect, Stream } from "effect"

/**
 * Event sink used by `streamFromEmitter`.
 *
 * @since 0.1.0
 * @category models
 */
export type EmitterSink<Event> = (event: Event) => Effect.Effect<void, never, never>

/**
 * Turn an effectful run function with event emission into a typed stream.
 *
 * On success, the stream terminates after all emitted events are consumed.
 * On failure, the stream fails with the same error.
 *
 * @since 0.1.0
 * @category combinators
 */
export const streamFromEmitter = <Event, A, E, R>(
  runWithEmitter: (emit: EmitterSink<Event>) => Effect.Effect<A, E, R>
): Stream.Stream<Event, E, R> =>
  Stream.asyncPush<Event, E, R>((emit) =>
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
