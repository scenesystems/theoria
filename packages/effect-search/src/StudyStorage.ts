/**
 * Optional durable snapshot and trial-log storage for studies.
 *
 * @since 0.7.0
 * @module
 */
import { FileSystem, Path } from "@effect/platform"
import * as StudyArtifact from "@scenesystems/effect-study/Artifact"
import {
  Array as Arr,
  Chunk,
  Data,
  DateTime,
  Effect,
  Layer,
  Number as Num,
  Option,
  Schema,
  Stream,
  Tuple
} from "effect"
import type * as Context from "effect/Context"

import * as Artifact from "./Artifact.js"
import * as ArtifactContext from "./ArtifactContext.js"
import * as ArtifactSink from "./ArtifactSink.js"
import { ArtifactStorageError } from "./SearchError.js"
import * as StudySnapshot from "./StudySnapshot.js"

const defaultFileName = "envelopes.jsonl"
const component = Arr.of("Study")
const Trials = Schema.Array(StudySnapshot.Trial)

/** Selects the artifact journal used by study storage. @since 0.7.0 @category models */
export class Options extends Data.Class<{
  readonly directory: string
  readonly fileName: string
}> {}

/** Creates storage options for the default envelope journal. @since 0.7.0 @category constructors */
export const options = (directory: string, fileName = defaultFileName): Options => new Options({ directory, fileName })

/** Snapshot and append-log persistence capability. @since 0.7.0 @category services */
export class StudyStorage extends Effect.Tag("effect-search/StudyStorage")<
  StudyStorage,
  {
    readonly appendTrial: (trial: StudySnapshot.Trial) => Effect.Effect<void, ArtifactStorageError>
    readonly writeSnapshot: (snapshot: StudySnapshot.StudySnapshot) => Effect.Effect<void, ArtifactStorageError>
    readonly loadSnapshot: () => Effect.Effect<Option.Option<StudySnapshot.StudySnapshot>, ArtifactStorageError>
    readonly loadTrialLog: () => Effect.Effect<typeof Trials.Type, ArtifactStorageError>
    readonly replayTrialLog: () => Effect.Effect<typeof Trials.Type, ArtifactStorageError>
  }
>() {}

/** Study storage implementation. @since 0.7.0 @category models */
export type Service = Context.Tag.Service<typeof StudyStorage>

const storageError =
  (operation: "read" | "write", path: string) => (cause: { readonly message: string }): ArtifactStorageError =>
    new ArtifactStorageError({ operation, path, detail: cause.message })

const envelopeMetadata = (context: Context.Tag.Service<typeof ArtifactContext.ArtifactContext>) => ({
  schemaVersion: StudyArtifact.Version.literals[0],
  producer: Artifact.EffectSearch({
    packageVersion: context.packageVersion,
    component,
    runId: context.runId
  }),
  relations: Arr.of(StudyArtifact.Run({ ref: context.runId }))
})

const trialEnvelope = (
  context: Context.Tag.Service<typeof ArtifactContext.ArtifactContext>,
  artifactId: StudyArtifact.Id,
  emittedAt: DateTime.Utc,
  trial: StudySnapshot.Trial
): Artifact.Envelope =>
  Artifact.TrialLog({
    ...envelopeMetadata(context),
    lineage: {
      sourceRef: { origin: "effect-search", domain: "study", segments: Arr.of("trial") },
      artifactId,
      emittedAt
    },
    trial
  })

const snapshotEnvelope = (
  context: Context.Tag.Service<typeof ArtifactContext.ArtifactContext>,
  artifactId: StudyArtifact.Id,
  emittedAt: DateTime.Utc,
  snapshot: StudySnapshot.StudySnapshot
): Artifact.Envelope =>
  Artifact.StudySnapshot({
    ...envelopeMetadata(context),
    lineage: {
      sourceRef: { origin: "effect-search", domain: "study", segments: Arr.of("snapshot") },
      artifactId,
      emittedAt
    },
    snapshot
  })

/** Creates storage over the ambient artifact sink and context. @since 0.7.0 @category constructors */
export const make = (
  config: Options
): Effect.Effect<
  Service,
  ArtifactStorageError,
  FileSystem.FileSystem | Path.Path | ArtifactSink.ArtifactSink | ArtifactContext.ArtifactContext
> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const sink = yield* ArtifactSink.ArtifactSink
    const context = yield* ArtifactContext.ArtifactContext
    const journalPath = path.join(config.directory, config.fileName)
    yield* fileSystem.makeDirectory(config.directory, { recursive: true }).pipe(
      Effect.mapError(storageError("write", config.directory))
    )

    const load = ArtifactSink.read(journalPath).pipe(
      Stream.provideService(FileSystem.FileSystem, fileSystem),
      Stream.runCollect,
      Effect.map(Chunk.toReadonlyArray)
    )
    const loadSnapshot = load.pipe(
      Effect.map((envelopes) =>
        Arr.findLast(envelopes, Artifact.is("StudySnapshot")).pipe(
          Option.map((envelope) => envelope.snapshot)
        )
      )
    )
    const loadTrialLog = load.pipe(
      Effect.map((envelopes) => Arr.map(Arr.filter(envelopes, Artifact.is("TrialLog")), (envelope) => envelope.trial))
    )

    return {
      appendTrial: (trial) =>
        Effect.all({ artifactId: context.nextId, emittedAt: DateTime.now }).pipe(
          Effect.map(({ artifactId, emittedAt }) => trialEnvelope(context, artifactId, emittedAt, trial)),
          Effect.flatMap(sink.emit)
        ),
      writeSnapshot: (snapshot) =>
        Effect.all({ artifactId: context.nextId, emittedAt: DateTime.now }).pipe(
          Effect.map(({ artifactId, emittedAt }) => snapshotEnvelope(context, artifactId, emittedAt, snapshot)),
          Effect.flatMap(sink.emit)
        ),
      loadSnapshot: () => loadSnapshot,
      loadTrialLog: () => loadTrialLog,
      replayTrialLog: () =>
        Effect.all(Tuple.make(loadSnapshot, loadTrialLog)).pipe(
          Effect.map(([snapshot, trials]) =>
            Option.match(snapshot, {
              onNone: () => trials,
              onSome: (value) =>
                Arr.filter(trials, (trial) => Num.greaterThanOrEqualTo(trial.trialNumber, value.nextTrialNumber))
            })
          )
        )
    }
  })

/** Installs study storage. @since 0.7.0 @category layers */
export const layer = (config: Options) => Layer.effect(StudyStorage, make(config))

const optional = <A>(
  present: (storage: Service) => Effect.Effect<A, ArtifactStorageError>,
  absent: Effect.Effect<A>
): Effect.Effect<A, ArtifactStorageError> =>
  Effect.serviceOption(StudyStorage).pipe(
    Effect.flatMap(Option.match({ onNone: () => absent, onSome: present }))
  )

/** Appends only when storage is present in the ambient context. @since 0.7.0 @category combinators */
export const appendIfAvailable = (trial: StudySnapshot.Trial): Effect.Effect<void, ArtifactStorageError> =>
  optional((storage) => storage.appendTrial(trial), Effect.void)

/** Writes only when storage is present in the ambient context. @since 0.7.0 @category combinators */
export const writeIfAvailable = (snapshot: StudySnapshot.StudySnapshot): Effect.Effect<void, ArtifactStorageError> =>
  optional((storage) => storage.writeSnapshot(snapshot), Effect.void)
