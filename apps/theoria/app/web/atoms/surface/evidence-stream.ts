import { Effect, Either, Match, Option, Stream } from "effect"
import * as Arr from "effect/Array"
import * as ParseResult from "effect/ParseResult"

import {
  EntryDecodeError,
  type EntryError,
  EntryExecutionError,
  EntryRequestError
} from "../../../contracts/entry-error.js"
import type { EntryId } from "../../../contracts/entry/id.js"
import {
  decodeEvidenceEventJson,
  type EvidenceEvent,
  SectionAppend,
  StreamComplete
} from "../../../contracts/evidence/stream.js"
import {
  type SurfaceRuntime,
  type SurfaceRuntimeServices,
  type SurfaceRuntimeSnapshot
} from "../../runtime/kernel/surface-runtime.js"

const decodeSseEvent = (data: string): Either.Either<EvidenceEvent, EntryError> =>
  decodeEvidenceEventJson(data).pipe(
    Either.mapLeft((error) => EntryDecodeError.make({ message: ParseResult.TreeFormatter.formatErrorSync(error) }))
  )

type RuntimeStreamRequest = {
  readonly id: EntryId
  readonly runtime: SurfaceRuntime
  readonly runtimeSnapshot: SurfaceRuntimeSnapshot
  readonly runToken: string | null
}

type RuntimeFetchRequest = {
  readonly id: EntryId
  readonly runtime: SurfaceRuntime
  readonly runtimeSnapshot: SurfaceRuntimeSnapshot
  readonly runToken: string
}

export class EvidenceStream {
  static fromSseUrl<R>({
    failureLabel,
    resolveUrl
  }: {
    readonly failureLabel: string
    readonly resolveUrl: Effect.Effect<string, EntryError, R>
  }): Stream.Stream<EvidenceEvent, EntryError, R> {
    return Stream.asyncPush<EvidenceEvent, EntryError, R>((emit) =>
      Effect.acquireRelease(
        Effect.gen(function*() {
          const eventSource = new EventSource(yield* resolveUrl)
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
                    emit.fail(EntryExecutionError.make(error))
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
                EntryRequestError.make({
                  message: streamState.deliveredEvent
                    ? `Evidence stream for ${failureLabel} ended before completion metadata arrived.`
                    : `Failed to stream evidence for ${failureLabel}.`
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
  }
}

export class RuntimeEvidenceStream {
  static fromSse({
    id,
    runtime,
    runtimeSnapshot,
    runToken
  }: RuntimeStreamRequest): Stream.Stream<EvidenceEvent, EntryError, SurfaceRuntimeServices> {
    return EvidenceStream.fromSseUrl({
      failureLabel: id,
      resolveUrl: Option.match(runtime.streamUrl, {
        onNone: () =>
          Effect.fail(
            EntryRequestError.make({ message: `Evidence stream for ${id} is missing a runtime stream URL.` })
          ),
        onSome: (streamUrl) => Effect.succeed(streamUrl(runtimeSnapshot, runToken))
      })
    })
  }

  static fromFetch({
    id,
    runtime,
    runtimeSnapshot,
    runToken
  }: RuntimeFetchRequest): Stream.Stream<EvidenceEvent, EntryError, SurfaceRuntimeServices> {
    return Stream.unwrap(
      Option.match(runtime.runWithMeta, {
        onNone: () =>
          Effect.fail(
            EntryRequestError.make({ message: `Evidence stream for ${id} is missing a runtime fetch transport.` })
          ),
        onSome: (runWithMeta) =>
          runWithMeta(runtimeSnapshot, runToken).pipe(
            Effect.map(({ data, meta }) =>
              Stream.concat(
                Stream.fromIterable(Arr.map(data.sections, (section) => SectionAppend.make({ section }))),
                Stream.succeed(StreamComplete.make({ summary: data.summary, meta }))
              )
            )
          )
      })
    )
  }
}

export class ServerEvidenceStream {
  static fromRuntime(
    request: RuntimeStreamRequest
  ): Stream.Stream<EvidenceEvent, EntryError, SurfaceRuntimeServices> {
    return request.runtime.transport === "sse"
      ? RuntimeEvidenceStream.fromSse(request)
      : RuntimeEvidenceStream.fromFetch({
        id: request.id,
        runtime: request.runtime,
        runtimeSnapshot: request.runtimeSnapshot,
        runToken: request.runToken ?? `${request.id}:runtime-fetch`
      })
  }
}
