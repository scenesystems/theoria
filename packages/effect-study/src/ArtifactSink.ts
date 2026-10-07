/**
 * Schema-owned artifact delivery and journal persistence.
 *
 * @since 0.1.0
 * @module
 */
import { Context, Effect, type FileSystem, Layer, type Path, Schema, type Stream } from "effect"

import * as Journal from "./Journal.js"
import * as PersistenceError from "./PersistenceError.js"

const defaultFileName = "artifacts.jsonl"

/**
 * Delivers artifacts after encoding them with their producer-owned schema.
 * Schema requirements remain requirements of each emission.
 *
 * @since 0.1.0
 * @category services
 */
export class ArtifactSink extends Context.Service<
  ArtifactSink,
  {
    readonly emit: <A, I, RD, RE>(
      schema: Schema.Codec<A, I, RD, RE>,
      artifact: A
    ) => Effect.Effect<void, PersistenceError.Failure, RE>
  }
>()("@scenesystems/effect-study/ArtifactSink") {}

/** Artifact sink implementation. @since 0.1.0 @category services */
export type Service = ArtifactSink["Service"]

/** Installs an existing artifact sink. @since 0.1.0 @category layers */
export const layer = (service: Service): Layer.Layer<ArtifactSink> => Layer.succeed(ArtifactSink, service)

/**
 * Creates an append-only sink. Artifacts are schema-encoded before the unknown
 * journal serializes that encoded value exactly once as JSON.
 * Encoding failures carry the destination journal path.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeFileSystem = (
  directory: string,
  fileName = defaultFileName
): Effect.Effect<Service, PersistenceError.Failure, FileSystem.FileSystem | Path.Path> =>
  Journal.make(Schema.Unknown, directory, fileName).pipe(
    Effect.map((journal) => ({
      emit: <A, I, RD, RE>(
        schema: Schema.Codec<A, I, RD, RE>,
        artifact: A
      ): Effect.Effect<void, PersistenceError.Failure, RE> =>
        Schema.encodeEffect(schema)(artifact).pipe(
          Effect.mapError((cause) =>
            new PersistenceError.Failure({
              reason: "Codec",
              operation: "write",
              path: journal.path,
              detail: cause.message
            })
          ),
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
): Layer.Layer<ArtifactSink, PersistenceError.Failure, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(ArtifactSink, makeFileSystem(directory, fileName))

/**
 * Reads artifacts in physical journal order with the caller-owned schema.
 * JSON and artifact-schema failures carry the path and physical line number,
 * counting blank lines. Reads retain only the schema's decoding requirements.
 *
 * @since 0.1.0
 * @category operations
 */
export const read = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  path: string
): Stream.Stream<A, PersistenceError.Failure, FileSystem.FileSystem | RD> => Journal.read(schema, path)

/** Delivers an artifact through the ambient sink. @since 0.1.0 @category operations */
export const emit = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
  artifact: A
): Effect.Effect<void, PersistenceError.Failure, ArtifactSink | RE> =>
  ArtifactSink.pipe(Effect.flatMap((sink) => sink.emit(schema, artifact)))

/**
 * Delivers to the left sink and only then to the right sink after the left succeeds.
 * Delivery is awaited and non-transactional: a right failure does not undo the left.
 * Retrying may deliver to the left again; reuse the same artifact identity and let
 * each sink own deduplication. Fanout neither allocates identities nor retries.
 *
 * @since 0.1.0
 * @category operations
 */
export const fanout = (left: Service, right: Service): Service => ({
  emit: <A, I, RD, RE>(
    schema: Schema.Codec<A, I, RD, RE>,
    artifact: A
  ): Effect.Effect<void, PersistenceError.Failure, RE> =>
    left.emit(schema, artifact).pipe(Effect.andThen(right.emit(schema, artifact)))
})
