/**
 * Generic event-stream bridge for optimizer runtimes.
 *
 * @since 0.1.0
 */
import { Effect, Match, PubSub, Stream } from "effect"

type StreamBridgeMessage<Event, E> =
  | Readonly<{ readonly _tag: "Event"; readonly event: Event }>
  | Readonly<{ readonly _tag: "Failure"; readonly error: E }>
  | Readonly<{ readonly _tag: "Completed" }>

const eventMessage = <Event, E>(event: Event): StreamBridgeMessage<Event, E> => ({ _tag: "Event", event })

const failureMessage = <Event, E>(error: E): StreamBridgeMessage<Event, E> => ({ _tag: "Failure", error })

const completionMessage = <Event, E>(): StreamBridgeMessage<Event, E> => ({ _tag: "Completed" })

const isTerminalMessage = <Event, E>(message: StreamBridgeMessage<Event, E>): boolean => message._tag !== "Event"

const messageToStream = <Event, E>(
  message: StreamBridgeMessage<Event, E>
): Stream.Stream<Event, E> =>
  Match.value(message).pipe(
    Match.tag("Event", ({ event }) => Stream.succeed(event)),
    Match.tag("Failure", ({ error }) => Stream.fail(error)),
    Match.tag("Completed", () => Stream.empty),
    Match.exhaustive
  )

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
  Stream.unwrapScoped(
    Effect.gen(function*() {
      const pubsub = yield* PubSub.unbounded<StreamBridgeMessage<Event, E>>()
      const subscriber = yield* PubSub.subscribe(pubsub)

      yield* Effect.addFinalizer(() => PubSub.shutdown(pubsub))

      const publish = (message: StreamBridgeMessage<Event, E>) => PubSub.publish(pubsub, message).pipe(Effect.asVoid)
      const emit: EmitterSink<Event> = (event) => publish(eventMessage(event))

      yield* runWithEmitter(emit).pipe(
        Effect.matchEffect({
          onFailure: (error) => publish(failureMessage(error)),
          onSuccess: () => publish(completionMessage())
        }),
        Effect.forkScoped
      )

      return Stream.fromQueue(subscriber).pipe(
        Stream.takeUntil(isTerminalMessage),
        Stream.flatMap(messageToStream)
      )
    })
  )
