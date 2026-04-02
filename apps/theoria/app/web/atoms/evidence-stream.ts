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
import { encodeStreamManifest, type StreamManifest } from "../../contracts/stream-manifest.js"
import { DemoClient } from "../services/DemoClient.js"

const sseStreamIds: ReadonlyArray<Id> = ["effect-text", "effect-search", "effect-math", "effect-dsp"]
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
  manifest: string | null = null
): Stream.Stream<EvidenceEvent, DemoError, DemoClient> =>
  Stream.asyncPush<EvidenceEvent, DemoError, DemoClient>((emit) =>
    Effect.acquireRelease(
      Effect.gen(function*() {
        const client = yield* DemoClient
        const eventSource = new EventSource(client.streamUrl(id, manifest))
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
              emit.fail(left)
              close()
            }),
            Match.orElse(({ right }) => {
              streamState.deliveredEvent = true

              Match.value(right).pipe(
                Match.tag("StreamFailed", ({ error }) => {
                  streamState.terminalEvent = true
                  emit.fail(new DemoExecutionError(error))
                  close()
                }),
                Match.tag("StreamComplete", () => {
                  streamState.terminalEvent = true
                  emit.single(right)
                  emit.end()
                  close()
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
            emit.fail(
              new DemoRequestError({
                message: streamState.deliveredEvent
                  ? `Evidence stream for ${id} ended before completion metadata arrived.`
                  : `Failed to stream evidence for ${id}.`
              })
            )
            close()
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
  manifest: StreamManifest | null = null
): Stream.Stream<EvidenceEvent, DemoError, DemoClient> => {
  const encoded = manifest !== null ? encodeStreamManifest(manifest) : null

  return sseStreamIds.includes(id)
    ? makeSseEvidenceStream(id, encoded)
    : paceEvidenceStream(makeFetchEvidenceStream(id))
}

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
