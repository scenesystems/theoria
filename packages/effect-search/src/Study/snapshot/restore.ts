/**
 * Study state restoration from snapshots with search space and sampler re-hydration.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Either, Equal, Match, Number as Num, Schema } from "effect"

import { type ObjectiveSpec, ObjectiveSpecSchema } from "../../contracts/ObjectiveSpec.js"
import { InvalidStudyConfig } from "../../Errors/index.js"
import * as Sampler from "../../Sampler/index.js"
import * as SearchSpace from "../../SearchSpace/index.js"
import type * as Trial from "../../Trial/index.js"
import { isCompletedTrial } from "../best.js"
import { ExecuteSeed } from "../runtime.js"
import type { StopMode } from "../runtime/pruning.js"
import { snapshotToTrial, type SnapshotTrial } from "./stateCodec.js"
import { decodeStudySnapshot, type StudySnapshot } from "./versioning.js"

const ObjectiveSpecJsonSchema = Schema.parseJson(ObjectiveSpecSchema)
const SamplerKindJsonSchema = Schema.parseJson(Sampler.SamplerKindSchema)

const objectiveSpecSignature = (objectiveSpec: Schema.Schema.Type<typeof ObjectiveSpecSchema>): string =>
  Schema.encodeSync(ObjectiveSpecJsonSchema)(objectiveSpec)

const samplerKindSignature = (samplerKind: Schema.Schema.Type<typeof Sampler.SamplerKindSchema>): string =>
  Schema.encodeSync(SamplerKindJsonSchema)(samplerKind)

const decodeSnapshotPayload = (
  snapshot: StudySnapshot
): Effect.Effect<StudySnapshot, InvalidStudyConfig> =>
  decodeStudySnapshot(snapshot).pipe(
    Effect.mapError(() =>
      new InvalidStudyConfig({
        reason: "Study.resume snapshot payload decode failed"
      })
    )
  )

const decodeSnapshotTrialConfig = <Space extends SearchSpace.SearchSpace>(
  space: Space,
  trial: SnapshotTrial
): Effect.Effect<SearchSpace.Type<Space>, InvalidStudyConfig> =>
  Match.value(Schema.decodeUnknownEither(space.schema)(trial.config)).pipe(
    Match.when(Either.isRight, ({ right }) => Effect.succeed(right)),
    Match.orElse(() =>
      Effect.fail(
        new InvalidStudyConfig({
          reason: `Study.resume snapshot trial ${trial.trialNumber} does not decode against the provided search space`
        })
      )
    )
  )

const nextTrialNumberFromTrials = <Config>(trials: ReadonlyArray<Trial.Trial<Config>>): number =>
  Num.increment(
    Arr.reduce(trials, -1, (currentMax, trial) => Num.max(currentMax, trial.trialNumber))
  )

const completedCountFromTrials = <Config>(trials: ReadonlyArray<Trial.Trial<Config>>): number =>
  Arr.reduce(
    trials,
    0,
    (count, trial) => (isCompletedTrial(trial) ? Num.increment(count) : count)
  )

/**
 * Validates and restores a study snapshot, verifying space fingerprint, objective spec, sampler kind, and stop mode compatibility.
 *
 * @since 0.1.0
 * @category utils
 */
export const restoreSnapshot = <Space extends SearchSpace.SearchSpace>(
  space: Space,
  sampler: Sampler.Sampler,
  objectiveSpec: ObjectiveSpec,
  stopMode: StopMode,
  snapshot: StudySnapshot
): Effect.Effect<ExecuteSeed<SearchSpace.Type<Space>>, InvalidStudyConfig> =>
  Effect.fn("effect-search/Study.restoreSnapshot")(
    <CurrentSpace extends SearchSpace.SearchSpace>(
      currentSpace: CurrentSpace,
      currentSampler: Sampler.Sampler,
      currentObjectiveSpec: ObjectiveSpec,
      currentStopMode: StopMode,
      currentSnapshot: StudySnapshot
    ): Effect.Effect<ExecuteSeed<SearchSpace.Type<CurrentSpace>>, InvalidStudyConfig> =>
      Effect.gen(function*() {
        const decodedSnapshot = yield* decodeSnapshotPayload(currentSnapshot)
        const runtimeSpaceFingerprint = SearchSpace.fingerprint(currentSpace)
        const runtimeObjectiveSignature = objectiveSpecSignature(currentObjectiveSpec)
        const snapshotObjectiveSignature = objectiveSpecSignature(decodedSnapshot.objectiveSpec)
        const runtimeSamplerSignature = samplerKindSignature(currentSampler.kind)
        const snapshotSamplerSignature = samplerKindSignature(decodedSnapshot.samplerKind)

        yield* Effect.when(
          Effect.fail(
            new InvalidStudyConfig({
              reason: `Study.resume space fingerprint mismatch: expected ${decodedSnapshot.spaceFingerprint}, ` +
                `received ${runtimeSpaceFingerprint}`
            })
          ),
          () => !Equal.equals(decodedSnapshot.spaceFingerprint, runtimeSpaceFingerprint)
        )

        yield* Effect.when(
          Effect.fail(
            new InvalidStudyConfig({
              reason: "Study.resume objective spec mismatch between snapshot and runtime options"
            })
          ),
          () => !Equal.equals(runtimeObjectiveSignature, snapshotObjectiveSignature)
        )

        yield* Effect.when(
          Effect.fail(
            new InvalidStudyConfig({
              reason:
                `Study.resume stop mode mismatch: expected ${decodedSnapshot.stopMode}, received ${currentStopMode}`
            })
          ),
          () => !Equal.equals(decodedSnapshot.stopMode, currentStopMode)
        )

        yield* Effect.when(
          Effect.fail(
            new InvalidStudyConfig({
              reason: `Study.resume sampler kind mismatch: expected ${decodedSnapshot.samplerKind._tag}, ` +
                `received ${currentSampler.kind._tag}`
            })
          ),
          () => !Equal.equals(runtimeSamplerSignature, snapshotSamplerSignature)
        )

        yield* Sampler.SamplerSpi.pipe(
          Effect.flatMap((service) => service.restore(decodedSnapshot.samplerCheckpoint)),
          Effect.provide(Sampler.SamplerSpiLayer(currentSampler))
        )

        const restoredTrials = yield* Effect.forEach(decodedSnapshot.trials, (trial) =>
          decodeSnapshotTrialConfig(currentSpace, trial).pipe(
            Effect.map((config) => snapshotToTrial(trial, config))
          ))

        const computedNextTrialNumber = nextTrialNumberFromTrials(restoredTrials)
        const computedCompletedCount = completedCountFromTrials(restoredTrials)

        yield* Effect.when(
          Effect.fail(
            new InvalidStudyConfig({
              reason:
                `Study.resume snapshot nextTrialNumber mismatch: expected ${computedNextTrialNumber}, received ${decodedSnapshot.nextTrialNumber}`
            })
          ),
          () =>
            !Equal.equals(computedNextTrialNumber, decodedSnapshot.nextTrialNumber)
        )

        yield* Effect.when(
          Effect.fail(
            new InvalidStudyConfig({
              reason:
                `Study.resume snapshot completedCount mismatch: expected ${computedCompletedCount}, received ${decodedSnapshot.completedCount}`
            })
          ),
          () => !Equal.equals(computedCompletedCount, decodedSnapshot.completedCount)
        )

        return new ExecuteSeed({
          initialTrials: restoredTrials,
          startTrialNumber: decodedSnapshot.nextTrialNumber
        })
      })
  )(space, sampler, objectiveSpec, stopMode, snapshot)
