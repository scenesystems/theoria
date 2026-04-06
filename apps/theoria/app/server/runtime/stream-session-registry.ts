import { Effect, HashMap, Option, Queue, Stream, SynchronizedRef } from "effect"

import type { EvidenceEvent } from "../../contracts/evidence-stream.js"

type StreamBatch = {
  readonly index: number
  readonly events: ReadonlyArray<EvidenceEvent>
}

type StreamSession = {
  readonly batches: ReadonlyArray<StreamBatch>
  readonly executionId: string | null
  readonly started: boolean
  readonly subscribers: ReadonlyArray<Queue.Queue<StreamBatch>>
}

type StreamSessionMap = HashMap.HashMap<string, StreamSession>

type Subscription = {
  readonly backlog: ReadonlyArray<StreamBatch>
  readonly subscriber: Queue.Queue<StreamBatch>
}

const emptyStreamSession: StreamSession = {
  batches: [],
  executionId: null,
  started: false,
  subscribers: []
}

const sessionUpdate = <A>(value: A, sessions: StreamSessionMap): readonly [A, StreamSessionMap] => [
  value,
  sessions
]

const streamSession = (
  sessions: HashMap.HashMap<string, StreamSession>,
  sessionKey: string
): StreamSession => Option.getOrElse(HashMap.get(sessions, sessionKey), () => emptyStreamSession)

const hasBatchIndex = (session: StreamSession, batchIndex: number): boolean =>
  session.batches.some((batch) => batch.index === batchIndex)

const streamFromBatches = (batches: ReadonlyArray<StreamBatch>): Stream.Stream<EvidenceEvent, never, never> =>
  Stream.fromIterable(batches).pipe(Stream.flatMap((batch) => Stream.fromIterable(batch.events)))

const subscription = (
  backlog: ReadonlyArray<StreamBatch>,
  subscriber: Queue.Queue<StreamBatch>
): Subscription => ({ backlog, subscriber })

export class RunStreamSessionRegistry extends Effect.Service<RunStreamSessionRegistry>()(
  "theoria/server/RunStreamSessionRegistry",
  {
    effect: Effect.gen(function*() {
      const sessionsRef = yield* SynchronizedRef.make(HashMap.empty<string, StreamSession>())

      const removeSubscriber = (
        sessionKey: string,
        subscriber: Queue.Queue<StreamBatch>
      ): Effect.Effect<void, never, never> =>
        SynchronizedRef.update(sessionsRef, (sessions) => {
          const session = streamSession(sessions, sessionKey)

          return HashMap.set(sessions, sessionKey, {
            ...session,
            subscribers: session.subscribers.filter((current) => current !== subscriber)
          })
        })

      return {
        appendBatch: ({
          batchIndex,
          events,
          sessionKey
        }: {
          readonly batchIndex: number
          readonly events: ReadonlyArray<EvidenceEvent>
          readonly sessionKey: string
        }) =>
          events.length === 0
            ? Effect.void
            : SynchronizedRef.modifyEffect(sessionsRef, (sessions) => {
              const session = streamSession(sessions, sessionKey)

              return hasBatchIndex(session, batchIndex)
                ? Effect.succeed(sessionUpdate(undefined, sessions))
                : Effect.forEach(
                  session.subscribers,
                  (subscriber) => Queue.offer(subscriber, { index: batchIndex, events }).pipe(Effect.asVoid),
                  { discard: true }
                ).pipe(
                  Effect.as(
                    sessionUpdate(
                      undefined,
                      HashMap.set(sessions, sessionKey, {
                        ...session,
                        batches: [...session.batches, { index: batchIndex, events }]
                      })
                    )
                  )
                )
            }),
        ensureSession: (sessionKey: string) =>
          SynchronizedRef.update(sessionsRef, (sessions) =>
            HashMap.has(sessions, sessionKey)
              ? sessions
              : HashMap.set(sessions, sessionKey, emptyStreamSession)),
        markStarted: ({
          executionId,
          sessionKey
        }: {
          readonly executionId: string
          readonly sessionKey: string
        }) =>
          SynchronizedRef.modify(sessionsRef, (sessions) => {
            const session = streamSession(sessions, sessionKey)

            return session.started
              ? sessionUpdate(false, sessions)
              : sessionUpdate(
                true,
                HashMap.set(sessions, sessionKey, {
                  ...session,
                  executionId,
                  started: true
                })
              )
          }),
        subscribe: (sessionKey: string) =>
          Effect.acquireRelease(
            Queue.unbounded<StreamBatch>().pipe(
              Effect.flatMap((subscriber) =>
                SynchronizedRef.modify(sessionsRef, (sessions) => {
                  const session = streamSession(sessions, sessionKey)

                  return sessionUpdate(
                    subscription(session.batches, subscriber),
                    HashMap.set(sessions, sessionKey, {
                      ...session,
                      subscribers: [...session.subscribers, subscriber]
                    })
                  )
                })
              )
            ),
            ({ subscriber }) =>
              removeSubscriber(sessionKey, subscriber).pipe(
                Effect.zipRight(Queue.shutdown(subscriber))
              )
          ).pipe(
            Effect.map(({ backlog, subscriber }) =>
              Stream.concat(
                streamFromBatches(backlog),
                Stream.fromQueue(subscriber).pipe(
                  Stream.flatMap((batch) => Stream.fromIterable(batch.events))
                )
              )
            )
          )
      }
    })
  }
) {}
