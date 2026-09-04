/**
 * Reads and writes study snapshots and trial logs through artifact envelopes.
 *
 * @since 0.1.0
 */
import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Chunk, Data, Effect, Layer, Number as Num, Option, Stream } from "effect"
import type * as Context from "effect/Context"

import { ArtifactSink } from "../contracts/ArtifactSink.js"
import { EnvelopeContext } from "../contracts/EnvelopeContext.js"
import { readEnvelopeLog } from "../contracts/sinks/reader.js"
import { ArtifactStorageError } from "../Errors/Artifact.js"
import type { SnapshotTrial } from "./snapshot/stateCodec.js"
import type { StudySnapshot } from "./snapshot/versioning.js"
import { makeSnapshotEnvelopeFrom, makeTrialLogEnvelopeFrom } from "./storageEnvelopes.js"

const DEFAULT_ENVELOPE_FILE_NAME = "envelopes.jsonl"

/**
 * Selects the JSON-lines artifact log read by a study-storage service.
 *
 * @remarks
 * The supplied {@link ArtifactSink} must write to the same file if values emitted
 * by this service need to be available to its load operations.
 *
 * @since 0.1.0
 * @category models
 */
export class StudyStorageOptions extends Data.Class<{
  /** Directory containing the artifact envelope log. */
  readonly directory: string
  /** Artifact envelope log file name within `directory`. */
  readonly envelopeFileName: string
}> {}

const defaultStudyStorageOptions = (directory: string): StudyStorageOptions =>
  new StudyStorageOptions({
    directory,
    envelopeFileName: DEFAULT_ENVELOPE_FILE_NAME
  })

/**
 * Reads study data from `envelopes.jsonl` in the supplied directory.
 *
 * @since 0.1.0
 * @category constructors
 */
export const studyStorageOptions = (directory: string): StudyStorageOptions => defaultStudyStorageOptions(directory)

/**
 * Emits study records as artifact envelopes and reads them from a JSON-lines log.
 *
 * @remarks
 * Write completion has the durability semantics of the installed artifact sink, and a
 * sink that cannot accept an envelope fails the write with an {@link ArtifactStorageError}.
 * Loads fail the same way when the log cannot be read or holds an undecodable line
 * before its end; a log that does not exist yet loads as empty, and a torn final line
 * is skipped as crash residue.
 *
 * @since 0.1.0
 * @category services
 */
export class StudyStorage extends Effect.Tag("effect-search/Study/StudyStorage")<
  StudyStorage,
  {
    /** Emits one trial-log envelope. */
    readonly appendTrial: (trial: SnapshotTrial) => Effect.Effect<void, ArtifactStorageError>
    /** Emits one study-snapshot envelope. */
    readonly writeSnapshot: (snapshot: StudySnapshot) => Effect.Effect<void, ArtifactStorageError>
    /** Reads the last valid snapshot envelope, or `None` when the log holds none. */
    readonly loadSnapshot: () => Effect.Effect<Option.Option<StudySnapshot>, ArtifactStorageError>
    /** Reads every valid trial-log envelope in file order. */
    readonly loadTrialLog: () => Effect.Effect<Array<SnapshotTrial>, ArtifactStorageError>
    /** Reads trial-log entries whose number is at least the last snapshot's next trial number. */
    readonly replayTrialLog: () => Effect.Effect<Array<SnapshotTrial>, ArtifactStorageError>
  }
>() {}

/**
 * Describes the operations implemented by the {@link StudyStorage} service.
 *
 * @since 0.1.0
 * @category type-level
 */
export type StudyStorageApi = Context.Tag.Service<typeof StudyStorage>

/**
 * Creates storage that emits through {@link ArtifactSink} and reads a filesystem log.
 *
 * @remarks
 * The service requires filesystem and path services, an artifact sink, and an
 * {@link EnvelopeContext}. A directory that cannot be created fails construction with an
 * {@link ArtifactStorageError}. Appends allocate artifact IDs from the context and do not
 * add locking beyond the selected sink. Loads retain valid envelopes in file order and
 * fail when the log cannot be read. Replay returns the full trial log when no snapshot exists; otherwise it
 * keeps trial numbers greater than or equal to the last snapshot's `nextTrialNumber`.
 * It does not sort or deduplicate trials. Snapshot and trial-log data are read
 * independently without excluding concurrent writes.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeStudyStorage = (
  options: StudyStorageOptions
): Effect.Effect<
  StudyStorageApi,
  ArtifactStorageError,
  FileSystem.FileSystem | Path.Path | ArtifactSink | EnvelopeContext
> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const sink = yield* ArtifactSink
    const ctx = yield* EnvelopeContext
    const envelopePath = path.join(options.directory, options.envelopeFileName)

    yield* fileSystem.makeDirectory(options.directory, { recursive: true }).pipe(
      Effect.mapError((cause) =>
        new ArtifactStorageError({ operation: "write", path: options.directory, detail: cause.message })
      )
    )

    const appendTrial = (trial: SnapshotTrial): Effect.Effect<void, ArtifactStorageError> =>
      ctx.nextArtifactId.pipe(
        Effect.map((artifactId) => makeTrialLogEnvelopeFrom(ctx, artifactId, trial)),
        Effect.flatMap((envelope) => sink.emit(envelope))
      )

    const writeSnapshot = (snapshot: StudySnapshot): Effect.Effect<void, ArtifactStorageError> =>
      ctx.nextArtifactId.pipe(
        Effect.map((artifactId) => makeSnapshotEnvelopeFrom(ctx, artifactId, snapshot)),
        Effect.flatMap((envelope) => sink.emit(envelope))
      )

    const loadEnvelopes = () =>
      readEnvelopeLog(envelopePath).pipe(
        Stream.provideService(FileSystem.FileSystem, fileSystem),
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray)
      )

    const loadSnapshot = (): Effect.Effect<Option.Option<StudySnapshot>, ArtifactStorageError> =>
      loadEnvelopes().pipe(
        Effect.map((envelopes) =>
          Arr.findLast(envelopes, (e) => e._tag === "StudySnapshot").pipe(
            Option.flatMap((e) => (e._tag === "StudySnapshot" ? Option.some(e.snapshot) : Option.none()))
          )
        )
      )

    const loadTrialLog = (): Effect.Effect<Array<SnapshotTrial>, ArtifactStorageError> =>
      loadEnvelopes().pipe(
        Effect.map((envelopes) =>
          Arr.filterMap(envelopes, (e) => e._tag === "TrialLog" ? Option.some(e.trial) : Option.none())
        )
      )

    const replayTrialLog = (): Effect.Effect<Array<SnapshotTrial>, ArtifactStorageError> =>
      Effect.all([loadSnapshot(), loadTrialLog()]).pipe(
        Effect.map(([snapshotOption, trials]) =>
          Option.match(snapshotOption, {
            onNone: () => trials,
            onSome: (snapshot) =>
              Arr.filter(trials, (trial) => Num.greaterThanOrEqualTo(trial.trialNumber, snapshot.nextTrialNumber))
          })
        )
      )

    return {
      appendTrial,
      writeSnapshot,
      loadSnapshot,
      loadTrialLog,
      replayTrialLog
    }
  })

/**
 * Builds one {@link StudyStorage} using the required platform and artifact services.
 *
 * @remarks
 * Layer acquisition fails with an {@link ArtifactStorageError} when the log directory
 * cannot be created. The Layer does not acquire or release the supplied sink and context.
 *
 * @since 0.1.0
 * @category layers
 */
export const StudyStorageLive = (options: StudyStorageOptions) => Layer.effect(StudyStorage, makeStudyStorage(options))

const withOptionalStorage = <A>(
  onSome: (storage: StudyStorageApi) => Effect.Effect<A, ArtifactStorageError>,
  onNone: () => Effect.Effect<A>
): Effect.Effect<A, ArtifactStorageError> =>
  Effect.serviceOption(StudyStorage).pipe(
    Effect.flatMap(
      Option.match({
        onNone,
        onSome
      })
    )
  )

/**
 * Appends a trial to the storage log if the StudyStorage service is available; no-ops otherwise.
 *
 * @since 0.1.0
 * @category utils
 */
export const appendTrialIfAvailable = (trial: SnapshotTrial): Effect.Effect<void, ArtifactStorageError> =>
  withOptionalStorage(
    (storage) => storage.appendTrial(trial),
    () => Effect.void
  )

/**
 * Writes a study snapshot to the storage log if the StudyStorage service is available; no-ops otherwise.
 *
 * @since 0.1.0
 * @category utils
 */
export const writeSnapshotIfAvailable = (snapshot: StudySnapshot): Effect.Effect<void, ArtifactStorageError> =>
  withOptionalStorage(
    (storage) => storage.writeSnapshot(snapshot),
    () => Effect.void
  )
