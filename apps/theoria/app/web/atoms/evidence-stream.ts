import { Effect, Either, Match, Stream } from "effect"
import * as Arr from "effect/Array"
import * as ParseResult from "effect/ParseResult"

import { DemoDecodeError, type DemoError, DemoExecutionError, DemoRequestError } from "../../contracts/demo-error.js"
import {
  decodeEvidenceEventJson,
  type EvidenceEvent,
  SectionAppend,
  StreamComplete
} from "../../contracts/evidence-stream.js"
import type { Id } from "../../contracts/id.js"
import { DemoClient } from "../services/DemoClient.js"

const sseStreamIds: ReadonlyArray<Id> = ["effect-text", "effect-search", "effect-math"]
const eventPacingDelay = "180 millis"

const decodeSseEvent = (data: string): Either.Either<EvidenceEvent, DemoError> =>
  decodeEvidenceEventJson(data).pipe(
    Either.mapLeft((error) => new DemoDecodeError({ message: ParseResult.TreeFormatter.formatErrorSync(error) }))
  )

const pacedState = (hasDeliveredSection: boolean, event: EvidenceEvent): readonly [boolean, EvidenceEvent] => [
  hasDeliveredSection,
  event
]

const makeSseEvidenceStream = (
  id: Id,
  customText: string | null = null
): Stream.Stream<EvidenceEvent, DemoError, DemoClient> =>
  Stream.asyncPush<EvidenceEvent, DemoError, DemoClient>((emit) =>
    Effect.acquireRelease(
      Effect.gen(function*() {
        const client = yield* DemoClient
        const eventSource = new EventSource(client.streamUrl(id, customText))
        const streamState = { closed: false, deliveredEvent: false, terminalEvent: false }

        const close = () => {
          if (!streamState.closed) {
            streamState.closed = true
            eventSource.close()
          }
        }

        const onEvidence = (event: MessageEvent<string>) => {
          Match.value(decodeSseEvent(event.data)).pipe(
            Match.when(Either.isLeft, ({ left }) => {
              close()
              emit.fail(left)
            }),
            Match.orElse(({ right }) => {
              streamState.deliveredEvent = true

              Match.value(right).pipe(
                Match.tag("StreamFailed", ({ error }) => {
                  streamState.terminalEvent = true
                  close()
                  emit.fail(new DemoExecutionError(error))
                }),
                Match.tag("StreamComplete", () => {
                  streamState.terminalEvent = true
                  emit.single(right)
                  close()
                  emit.end()
                }),
                Match.orElse(() => {
                  emit.single(right)
                })
              )
            })
          )
        }

        const onError = () => {
          if (!streamState.closed && !streamState.terminalEvent) {
            close()
            emit.fail(
              new DemoRequestError({
                message: streamState.deliveredEvent
                  ? `Evidence stream for ${id} ended before completion metadata arrived.`
                  : `Failed to stream evidence for ${id}.`
              })
            )
          }
        }

        eventSource.addEventListener("evidence", onEvidence)
        eventSource.addEventListener("error", onError)

        return eventSource
      }),
      (eventSource) =>
        Effect.sync(() => {
          eventSource.close()
        })
    )
  )

const makeFetchEvidenceStream = (id: Id): Stream.Stream<EvidenceEvent, DemoError, DemoClient> =>
  Stream.unwrap(
    Effect.gen(function*() {
      const client = yield* DemoClient
      const { data, meta } = yield* client.runWithMeta(id)

      return Stream.concat(
        Stream.fromIterable(Arr.map(data.sections, (section) => new SectionAppend({ section }))),
        Stream.succeed(new StreamComplete({ summary: data.summary, meta }))
      )
    })
  )

export const makeServerEvidenceStream = (
  id: Id,
  customText: string | null = null
): Stream.Stream<EvidenceEvent, DemoError, DemoClient> =>
  sseStreamIds.includes(id)
    ? makeSseEvidenceStream(id, customText)
    : paceEvidenceStream(makeFetchEvidenceStream(id))

export const paceEvidenceStream = <E, R>(
  stream: Stream.Stream<EvidenceEvent, E, R>
): Stream.Stream<EvidenceEvent, E, R> =>
  stream.pipe(
    Stream.mapAccumEffect(false, (hasDeliveredSection, event) =>
      Match.value(event).pipe(
        Match.tag("SectionAppend", () =>
          Effect.if(hasDeliveredSection, {
            onTrue: () => Effect.sleep(eventPacingDelay),
            onFalse: () => Effect.void
          }).pipe(Effect.as(pacedState(true, event)))),
        Match.orElse(() => Effect.succeed(pacedState(hasDeliveredSection, event)))
      ))
  )
