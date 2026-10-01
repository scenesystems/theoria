/**
 * Schema-owned artifact delivery and journal persistence.
 *
 * @since 0.1.0
 * @module
 */
import type { FileSystem, Path } from "@effect/platform"
import { Effect, Layer, ParseResult, Schema, type Stream } from "effect"
import type * as Context from "effect/Context"

import * as Journal from "./Journal.js"

const defaultFileName = "artifacts.jsonl"

/**
 * Delivers artifacts after encoding them with their producer-owned schema.
 * Schema requirements remain requirements of each emission.
 *
 * @since 0.1.0
 * @category services
 */
export class ArtifactSink extends Effect.Tag("@scenesystems/effect-study/ArtifactSink")<
  ArtifactSink,
  {
    readonly emit: <A, I, R>(schema: Schema.Schema<A, I, R>, artifact: A) => Effect.Effect<void, Journal.Failure, R>
  }
>() {}

/** Artifact sink implementation. @since 0.1.0 @category services */
export type Service = Context.Tag.Service<typeof ArtifactSink>

const codecFailure = (path: string) => (cause: ParseResult.ParseError): Journal.Failure =>
  new Journal.Failure({ operation: "write", path, detail: ParseResult.TreeFormatter.formatErrorSync(cause) })

/** Installs an existing artifact sink. @since 0.1.0 @category layers */
export const layer = (service: Service): Layer.Layer<ArtifactSink> => Layer.succeed(ArtifactSink, service)

/**
 * Creates an append-only sink. Artifacts are schema-encoded before the unknown
 * journal serializes that encoded value exactly once as JSON.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeFileSystem = (
  directory: string,
  fileName = defaultFileName
): Effect.Effect<Service, Journal.Failure, FileSystem.FileSystem | Path.Path> =>
  Journal.make(Schema.Unknown, directory, fileName).pipe(
    Effect.map((journal) => ({
      emit: <A, I, R>(schema: Schema.Schema<A, I, R>, artifact: A): Effect.Effect<void, Journal.Failure, R> =>
        Schema.encode(schema)(artifact).pipe(
          Effect.mapError(codecFailure(journal.path)),
          Effect.flatMap(journal.append)
        )
    }))
  )

/**
 * Provides an append-only filesystem sink.
 *
 * @since 0.1.0
 * @category layers
 */
export const layerFileSystem = (
  directory: string,
  fileName = defaultFileName
): Layer.Layer<ArtifactSink, Journal.Failure, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(ArtifactSink, makeFileSystem(directory, fileName))

/**
 * Reads artifacts in physical journal order with the caller-owned schema.
 *
 * @since 0.1.0
 * @category operations
 */
export const read = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  path: string
): Stream.Stream<A, Journal.Failure, FileSystem.FileSystem | R> => Journal.read(schema, path)

/** Delivers an artifact through the ambient sink. @since 0.1.0 @category operations */
export const emit = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  artifact: A
): Effect.Effect<void, Journal.Failure, ArtifactSink | R> =>
  ArtifactSink.pipe(Effect.flatMap((sink) => sink.emit(schema, artifact)))

/**
 * Delivers to the left sink and only then to the right sink after the left succeeds.
 *
 * @since 0.1.0
 * @category operations
 */
export const fanout = (left: Service, right: Service): Service => ({
  emit: <A, I, R>(schema: Schema.Schema<A, I, R>, artifact: A): Effect.Effect<void, Journal.Failure, R> =>
    left.emit(schema, artifact).pipe(Effect.zipRight(right.emit(schema, artifact)))
})
