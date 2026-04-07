import { Effect, Either, Match, Option, Stream } from "effect"
import * as Arr from "effect/Array"
import * as ParseResult from "effect/ParseResult"

import { DemoDecodeError, type DemoError, DemoExecutionError, DemoRequestError } from "../../contracts/demo-error.js"
import {
  decodeEvidenceEventJson,
  type EvidenceEvent,
  SectionAppend,
  StreamComplete
} from "../../contracts/evidence-stream.js"
import type { Id, SurfaceId } from "../../contracts/id.js"
import { encodeStreamManifest, type StreamManifest } from "../../contracts/stream-manifest.js"
import {
  type SurfaceRuntime,
  type SurfaceRuntimeServices,
  type SurfaceRuntimeSnapshot,
  surfaceUsesSseTransport
} from "../runtime/surface-runtime.js"
import { DemoClient } from "../services/DemoClient.js"

const decodeSseEvent = (data: string): Either.Either<EvidenceEvent, DemoError> =>
  decodeEvidenceEventJson(data).pipe(
    Either.mapLeft((error) => new DemoDecodeError({ message: ParseResult.TreeFormatter.formatErrorSync(error) }))
  )

type RuntimeStreamRequest = {
  readonly id: SurfaceId
  readonly runtime: SurfaceRuntime
  readonly runtimeSnapshot: SurfaceRuntimeSnapshot
  readonly runToken: string | null
}

type RuntimeFetchRequest = {
  readonly id: SurfaceId
  readonly runtime: SurfaceRuntime
  readonly runtimeSnapshot: SurfaceRuntimeSnapshot
}

const makeSseEvidenceStreamFromUrl = <R>({
  failureLabel,
  resolveUrl
}: {
  readonly failureLabel: string
  readonly resolveUrl: Effect.Effect<string, DemoError, R>
}): Stream.Stream<EvidenceEvent, DemoError, R> =>
  Stream.asyncPush<EvidenceEvent, DemoError, R>((emit) =>
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

const makeSseEvidenceStream = (
  id: Id,
  manifest: string | null = null,
  runToken: string | null = null
): Stream.Stream<EvidenceEvent, DemoError, DemoClient> =>
  makeSseEvidenceStreamFromUrl({
    failureLabel: id,
    resolveUrl: Effect.gen(function*() {
      const client = yield* DemoClient
      return client.streamUrl(id, manifest, runToken)
    })
  })

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

const makeRuntimeSseEvidenceStream = ({
  id,
  runtime,
  runtimeSnapshot,
  runToken
}: RuntimeStreamRequest): Stream.Stream<EvidenceEvent, DemoError, SurfaceRuntimeServices> =>
  makeSseEvidenceStreamFromUrl({
    failureLabel: id,
    resolveUrl: Option.match(runtime.streamUrl, {
      onNone: () =>
        Effect.fail(
          new DemoRequestError({ message: `Evidence stream for ${id} is missing a runtime stream URL.` })
        ),
      onSome: (streamUrl) => Effect.succeed(streamUrl(runtimeSnapshot, runToken))
    })
  })

const makeRuntimeFetchEvidenceStream = ({
  id,
  runtime,
  runtimeSnapshot
}: RuntimeFetchRequest): Stream.Stream<EvidenceEvent, DemoError, SurfaceRuntimeServices> =>
  Stream.unwrap(
    Option.match(runtime.runWithMeta, {
      onNone: () =>
        Effect.fail(
          new DemoRequestError({ message: `Evidence stream for ${id} is missing a runtime fetch transport.` })
        ),
      onSome: (runWithMeta) =>
        runWithMeta(runtimeSnapshot).pipe(
          Effect.map(({ data, meta }) =>
            Stream.concat(
              Stream.fromIterable(Arr.map(data.sections, (section) => new SectionAppend({ section }))),
              Stream.succeed(new StreamComplete({ summary: data.summary, meta }))
            )
          )
        )
    })
  )

export function makeServerEvidenceStream(
  request: RuntimeStreamRequest
): Stream.Stream<EvidenceEvent, DemoError, SurfaceRuntimeServices>
export function makeServerEvidenceStream(
  id: Id,
  manifest?: StreamManifest | null,
  runToken?: string | null
): Stream.Stream<EvidenceEvent, DemoError, DemoClient>

export function makeServerEvidenceStream(
  requestOrId: RuntimeStreamRequest | Id,
  manifest: StreamManifest | null = null,
  runToken: string | null = null
):
  | Stream.Stream<EvidenceEvent, DemoError, DemoClient>
  | Stream.Stream<EvidenceEvent, DemoError, SurfaceRuntimeServices>
{
  if (typeof requestOrId !== "string") {
    return requestOrId.runtime.transport === "sse"
      ? makeRuntimeSseEvidenceStream(requestOrId)
      : makeRuntimeFetchEvidenceStream(requestOrId)
  }

  const encoded = manifest !== null ? encodeStreamManifest(manifest) : null

  return surfaceUsesSseTransport(requestOrId)
    ? makeSseEvidenceStream(requestOrId, encoded, runToken)
    : makeFetchEvidenceStream(requestOrId)
}
