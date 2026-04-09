/**
 * COPRO snapshots and effect-search compatibility projections.
 *
 * @since 0.2.0
 */
import { Array as Arr, Effect, Match, Ref, Schema } from "effect"
import * as SearchContracts from "effect-search/Contracts"
import * as Sampler from "effect-search/Sampler"
import * as Study from "effect-search/Study"
import * as StudyEvent from "effect-search/StudyEvent"
import * as Contracts from "../../contracts/index.js"
import * as Module from "../../Module/index.js"
import { SavedState } from "../../Module/model.js"

/** One evaluated COPRO trial. @since 0.2.0 @category models */
export class COPRORecordedTrial extends Schema.Class<COPRORecordedTrial>("COPRORecordedTrial")({
  trialNumber: Schema.Number,
  step: Schema.Number,
  predictorName: Schema.String,
  candidateIndex: Schema.Number,
  instruction: Schema.String,
  score: Schema.Number,
  improved: Schema.Boolean
}) {}

/** One accepted predictor update produced by COPRO. @since 0.2.0 @category models */
export class COPROAcceptedUpdate extends Schema.Class<COPROAcceptedUpdate>("COPROAcceptedUpdate")({
  step: Schema.Number,
  predictorName: Schema.String,
  instruction: Schema.String,
  score: Schema.Number,
  changed: Schema.Boolean
}) {}

/**
 * Resumable COPRO state with deterministic resume metadata.
 * @since 0.2.0
 * @category models
 */
export class COPROSnapshot extends Schema.Class<COPROSnapshot>("effect-dsp/COPROSnapshot")({
  snapshotFormatVersion: Schema.Literal(1),
  moduleName: Schema.String,
  moduleState: SavedState,
  numCandidates: Schema.Number,
  maxSteps: Schema.Number,
  nextStep: Schema.Number,
  nextTrialNumber: Schema.Number,
  seed: Schema.Number,
  baselineInstruction: Schema.String,
  bestInstruction: Schema.String,
  bestScore: Schema.Number,
  completionReason: Schema.Literal("budgetExhausted", "interrupted"),
  trials: Schema.Array(COPRORecordedTrial),
  acceptedUpdates: Schema.Array(COPROAcceptedUpdate)
}) {}

type COPROSnapshotState = Readonly<{
  readonly nextStep: number
  readonly nextTrialNumber: number
  readonly bestScore: number
  readonly trials: ReadonlyArray<COPRORecordedTrial>
  readonly acceptedUpdates: ReadonlyArray<COPROAcceptedUpdate>
}>

type ArtifactEnvelopeOptions = Readonly<{
  readonly runId: Contracts.RunId
  readonly packageVersion: Contracts.PackageVersion
  readonly emittedAt: Schema.Schema.Type<typeof Schema.DateTimeUtc>
  readonly metricName: string
}>

export namespace COPROSnapshot {
  export const fromRuntimeState = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(options: {
    readonly module: Module.Module<I, O>
    readonly baselineInstruction: string
    readonly numCandidates: number
    readonly maxSteps: number
    readonly seed: number
    readonly completionReason: COPROSnapshot["completionReason"]
    readonly state: COPROSnapshotState
  }) =>
    Effect.gen(function*() {
      const moduleState = yield* Module.save(options.module)
      const rootParams = yield* Ref.get(options.module.params)
      return COPROSnapshot.make({
        snapshotFormatVersion: 1,
        moduleName: options.module.name,
        moduleState,
        numCandidates: options.numCandidates,
        maxSteps: options.maxSteps,
        nextStep: options.state.nextStep,
        nextTrialNumber: options.state.nextTrialNumber,
        seed: options.seed,
        baselineInstruction: options.baselineInstruction,
        bestInstruction: rootParams.instructions,
        bestScore: options.state.bestScore,
        completionReason: options.completionReason,
        trials: options.state.trials,
        acceptedUpdates: options.state.acceptedUpdates
      })
    })

  /**
   * Project a COPRO snapshot into the canonical `effect-search` study snapshot.
   *
   * @since 0.2.0
   * @category constructors
   */
  export const projectStudySnapshot = (snapshot: COPROSnapshot): Study.StudySnapshot =>
    Study.StudySnapshot.fromMaterialized({
      spaceFingerprint: `effect-dsp/copro/${snapshot.moduleName}/${snapshot.numCandidates}/${snapshot.maxSteps}`,
      objectiveSpec: SearchContracts.singleObjectiveSpec("maximize"),
      stopMode: "Drain",
      samplerKind: Sampler.Random({ options: { seed: snapshot.seed } }),
      samplerCheckpoint: checkpoint(snapshot.seed),
      nextTrialNumber: snapshot.nextTrialNumber,
      trials: Arr.map(snapshot.trials, (trial) => ({
        trialNumber: trial.trialNumber,
        config: studyTrialConfig(trial),
        state: {
          _tag: "Completed",
          value: trial.score,
          duration: 1,
          retryCount: 0,
          evaluationCount: 1
        }
      })),
      completedCount: snapshot.trials.length
    })

  /**
   * Project COPRO trial history into canonical `effect-search` study events.
   *
   * @since 0.2.0
   * @category constructors
   */
  export const projectStudyEvents = (snapshot: COPROSnapshot): ReadonlyArray<StudyEvent.StudyEvent> =>
    Arr.append(
      Arr.flatMap(snapshot.trials, (trial) => [
        StudyEvent.TrialStarted({
          trialNumber: trial.trialNumber,
          config: studyTrialConfig(trial)
        }),
        StudyEvent.TrialCompleted({
          trialNumber: trial.trialNumber,
          value: trial.score
        }),
        ...Match.value(trial.improved).pipe(
          Match.when(true, () => [StudyEvent.BestUpdated({ trialNumber: trial.trialNumber, value: trial.score })]),
          Match.orElse(() => [])
        )
      ]),
      StudyEvent.StudyCompleted({ completionReason: snapshot.completionReason })
    )

  /**
   * Wrap a projected COPRO study event in the canonical artifact envelope.
   *
   * @since 0.2.0
   * @category constructors
   */
  export const projectStudyEventEnvelope = (
    options: ArtifactEnvelopeOptions & {
      readonly sequence: number
      readonly event: StudyEvent.StudyEvent
    }
  ) =>
    Contracts.StudyEventEnvelope({
      schemaVersion: "artifact-envelope/v1",
      producer: Contracts.EffectDsp({
        packageVersion: options.packageVersion,
        component: ["Optimizer", "copro", "events"],
        runId: options.runId,
        optimizer: "copro",
        metricName: options.metricName,
        exampleName: "copro"
      }),
      lineage: new Contracts.ArtifactLineage({
        sourceRef: new Contracts.SourceRef({
          origin: "effect-dsp",
          domain: "optimizer",
          segments: ["copro", "event"]
        }),
        artifactId: new Contracts.ArtifactId({ runId: options.runId, sequence: options.sequence }),
        emittedAt: options.emittedAt
      }),
      relations: [{ _tag: "Run", ref: options.runId }],
      event: options.event
    })

  /**
   * Wrap a projected COPRO study snapshot in the canonical artifact envelope.
   *
   * @since 0.2.0
   * @category constructors
   */
  export const projectStudySnapshotEnvelope = (
    options: ArtifactEnvelopeOptions & {
      readonly sequence: number
      readonly snapshot: COPROSnapshot
    }
  ) =>
    Contracts.StudySnapshotEnvelope({
      schemaVersion: "artifact-envelope/v1",
      producer: Contracts.EffectDsp({
        packageVersion: options.packageVersion,
        component: ["Optimizer", "copro", "snapshot"],
        runId: options.runId,
        optimizer: "copro",
        metricName: options.metricName,
        exampleName: "copro"
      }),
      lineage: new Contracts.ArtifactLineage({
        sourceRef: new Contracts.SourceRef({
          origin: "effect-dsp",
          domain: "optimizer",
          segments: ["copro", "snapshot"]
        }),
        artifactId: new Contracts.ArtifactId({ runId: options.runId, sequence: options.sequence }),
        emittedAt: options.emittedAt
      }),
      relations: [{ _tag: "Run", ref: options.runId }],
      snapshot: projectStudySnapshot(options.snapshot)
    })
}

const studyTrialConfig = (trial: COPRORecordedTrial) => ({
  step: trial.step,
  predictorName: trial.predictorName,
  candidateIndex: trial.candidateIndex,
  instruction: trial.instruction
})

const checkpoint = (seed: number): Sampler.SamplerCheckpoint => ({ _tag: "Random", seed })
