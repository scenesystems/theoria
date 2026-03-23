/**
 * File-system backed study storage for persisting snapshots, events, and trial logs.
 *
 * @since 0.1.0
 */
import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Chunk, Data, Effect, Layer, Number as Num, Option, Stream } from "effect"
import type * as Context from "effect/Context"

import { ArtifactSink } from "../contracts/ArtifactSink.js"
import { EnvelopeContext } from "../contracts/EnvelopeContext.js"
import { readEnvelopeLog } from "../contracts/sinks/reader.js"
import type { InvalidStudyConfig } from "../Errors/index.js"
import type { SnapshotTrial } from "./snapshot/stateCodec.js"
import type { StudySnapshot } from "./snapshot/versioning.js"
import { makeSnapshotEnvelopeFrom, makeTrialLogEnvelopeFrom } from "./storageEnvelopes.js"

const DEFAULT_ENVELOPE_FILE_NAME = "envelopes.jsonl"

/**
 * @since 0.1.0
 * @category models
 */
export class StudyStorageOptions extends Data.Class<{
  readonly directory: string
  readonly envelopeFileName: string
}> {}

const defaultStudyStorageOptions = (directory: string): StudyStorageOptions =>
  new StudyStorageOptions({
    directory,
    envelopeFileName: DEFAULT_ENVELOPE_FILE_NAME
  })

/**
 * @since 0.1.0
 * @category constructors
 */
export const studyStorageOptions = (directory: string): StudyStorageOptions => defaultStudyStorageOptions(directory)

/**
 * @since 0.1.0
 * @category services
 */
export class StudyStorage extends Effect.Tag("effect-search/Study/StudyStorage")<
  StudyStorage,
  {
    readonly appendTrial: (trial: SnapshotTrial) => Effect.Effect<void>
    readonly writeSnapshot: (snapshot: StudySnapshot) => Effect.Effect<void>
    readonly loadSnapshot: () => Effect.Effect<Option.Option<StudySnapshot>, InvalidStudyConfig>
    readonly loadTrialLog: () => Effect.Effect<Array<SnapshotTrial>, InvalidStudyConfig>
    readonly replayTrialLog: () => Effect.Effect<Array<SnapshotTrial>, InvalidStudyConfig>
  }
>() {}

/**
 * @since 0.1.0
 * @category type-level
 */
export type StudyStorageApi = Context.Tag.Service<typeof StudyStorage>

/**
 * @since 0.1.0
 * @category constructors
 */
export const makeStudyStorage = (
  options: StudyStorageOptions
): Effect.Effect<StudyStorageApi, never, FileSystem.FileSystem | Path.Path | ArtifactSink | EnvelopeContext> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const sink = yield* ArtifactSink
    const ctx = yield* EnvelopeContext
    const envelopePath = path.join(options.directory, options.envelopeFileName)

    yield* fileSystem.makeDirectory(options.directory, { recursive: true }).pipe(
      Effect.catchAll(() => Effect.void)
    )

    const appendTrial = (trial: SnapshotTrial): Effect.Effect<void> =>
      ctx.nextArtifactId.pipe(
        Effect.map((artifactId) => makeTrialLogEnvelopeFrom(ctx, artifactId, trial)),
        Effect.flatMap((envelope) => sink.emit(envelope)),
        Effect.catchAll(() => Effect.void)
      )

    const writeSnapshot = (snapshot: StudySnapshot): Effect.Effect<void> =>
      ctx.nextArtifactId.pipe(
        Effect.map((artifactId) => makeSnapshotEnvelopeFrom(ctx, artifactId, snapshot)),
        Effect.flatMap((envelope) => sink.emit(envelope)),
        Effect.catchAll(() => Effect.void)
      )

    const loadEnvelopes = () =>
      readEnvelopeLog(envelopePath).pipe(
        Stream.provideService(FileSystem.FileSystem, fileSystem),
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray)
      )

    const loadSnapshot = (): Effect.Effect<Option.Option<StudySnapshot>, InvalidStudyConfig> =>
      loadEnvelopes().pipe(
        Effect.map((envelopes) =>
          Arr.findLast(envelopes, (e) => e._tag === "StudySnapshot").pipe(
            Option.flatMap((e) => (e._tag === "StudySnapshot" ? Option.some(e.snapshot) : Option.none()))
          )
        )
      )

    const loadTrialLog = (): Effect.Effect<Array<SnapshotTrial>, InvalidStudyConfig> =>
      loadEnvelopes().pipe(
        Effect.map((envelopes) =>
          Arr.filterMap(envelopes, (e) => e._tag === "TrialLog" ? Option.some(e.trial) : Option.none())
        )
      )

    const replayTrialLog = (): Effect.Effect<Array<SnapshotTrial>, InvalidStudyConfig> =>
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
 * @since 0.1.0
 * @category layers
 */
export const StudyStorageLive = (options: StudyStorageOptions) => Layer.effect(StudyStorage, makeStudyStorage(options))

const withOptionalStorage = <A>(
  onSome: (storage: StudyStorageApi) => Effect.Effect<A>,
  onNone: () => Effect.Effect<A>
): Effect.Effect<A> =>
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
export const appendTrialIfAvailable = (trial: SnapshotTrial): Effect.Effect<void> =>
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
export const writeSnapshotIfAvailable = (snapshot: StudySnapshot): Effect.Effect<void> =>
  withOptionalStorage(
    (storage) => storage.writeSnapshot(snapshot),
    () => Effect.void
  )
