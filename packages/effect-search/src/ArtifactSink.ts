/**
 * Artifact envelope delivery and journal persistence.
 *
 * @since 0.4.4
 * @module
 */
import type { FileSystem, Path } from "@effect/platform"
import * as Journal from "@scenesystems/effect-study/Journal"
import { Effect, Layer, Option, Stream, String as Str } from "effect"
import type * as Context from "effect/Context"

import { type Envelope, Envelope as EnvelopeSchema } from "./Artifact.js"
import { ArtifactStorageError } from "./SearchError.js"

const fileName = "envelopes.jsonl"

/**
 * Delivers search artifact envelopes.
 *
 * @since 0.4.4
 * @category services
 */
export class ArtifactSink extends Effect.Tag("effect-search/ArtifactSink")<
  ArtifactSink,
  {
    readonly emit: (envelope: Envelope) => Effect.Effect<void, ArtifactStorageError>
  }
>() {}

/** Artifact sink service implementation. @since 0.4.4 @category models */
export type Service = Context.Tag.Service<typeof ArtifactSink>

const writeFailure = (cause: Journal.Error): ArtifactStorageError =>
  new ArtifactStorageError({ operation: "write", path: cause.path, detail: cause.detail })

const readFailure = (cause: Journal.Error): ArtifactStorageError =>
  new ArtifactStorageError({
    operation: "read",
    path: cause.path,
    detail: Option.fromNullable(cause.line).pipe(
      Option.match({
        onNone: () => cause.detail,
        onSome: () => Str.replace("is not a journal entry", "is not an artifact envelope")(cause.detail)
      })
    )
  })

/** Installs an existing sink implementation. @since 0.4.4 @category layers */
export const layer = (service: Service): Layer.Layer<ArtifactSink> => Layer.succeed(ArtifactSink, service)

/**
 * Builds an append-only `envelopes.jsonl` sink in a directory.
 *
 * @since 0.4.4
 * @category layers
 */
export const layerFileSystem = (
  directory: string
): Layer.Layer<ArtifactSink, ArtifactStorageError, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(
    ArtifactSink,
    Journal.make(EnvelopeSchema, directory, fileName).pipe(
      Effect.mapError(writeFailure),
      Effect.map((journal) => ({
        emit: (envelope) => journal.append(envelope).pipe(Effect.mapError(writeFailure))
      }))
    )
  )

/**
 * Reads a search artifact journal in source order.
 *
 * @since 0.4.4
 * @category readers
 */
export const read = (
  path: string
): Stream.Stream<Envelope, ArtifactStorageError, FileSystem.FileSystem> =>
  Journal.read(EnvelopeSchema, path).pipe(Stream.mapError(readFailure))

/** Delivers an envelope through the required sink. @since 0.4.4 @category combinators */
export const emit = (envelope: Envelope): Effect.Effect<void, ArtifactStorageError, ArtifactSink> =>
  ArtifactSink.emit(envelope)

/**
 * Delivers to the left sink, then to the right sink after the left succeeds.
 *
 * @since 0.4.4
 * @category combinators
 */
export const fanout = (left: Service, right: Service): Service => ({
  emit: (envelope) => left.emit(envelope).pipe(Effect.zipRight(right.emit(envelope)))
})
