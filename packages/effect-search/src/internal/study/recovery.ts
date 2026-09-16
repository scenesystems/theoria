/**
 * Resume seed construction from prior study snapshots or storage.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Option } from "effect"

import { InvalidStudyConfig, type SearchError } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
import * as StudySnapshot from "../../StudySnapshot.js"
import * as StudyStorage from "../../StudyStorage.js"
import type { ResumeFromStorageOptionsFromSpace, ResumeOptionsFromSpace } from "./options/input.js"
import type { OptimizePlan } from "./options/plan.js"
import {
  optimizePlanFromResume,
  resumeOptionsWithSnapshot,
  resumePlanFromOptions
} from "./options/plan/continuation.js"
import { normalizeSettings } from "./options/settings.js"
import { ExecuteSeed } from "./runtime.js"

/**
 * @since 0.1.0
 * @category models
 */
export class ResumeExecutionSeed<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> extends Data.Class<{
  readonly optimizePlan: OptimizePlan<Config, Space>
  readonly seed: ExecuteSeed<Config>
}> {}

/**
 * @since 0.1.0
 * @category utils
 */
export const resumeExecutionSeedFromOptions = <Space extends SearchSpace.SearchSpace>(
  options: ResumeOptionsFromSpace<Space>
): Effect.Effect<ResumeExecutionSeed<SearchSpace.Type<Space>, Space>, SearchError> =>
  Effect.gen(function*() {
    const resumePlan = yield* resumePlanFromOptions(options)
    const optimizePlan = optimizePlanFromResume(resumePlan)
    const settings = normalizeSettings(optimizePlan)
    const seed = yield* StudySnapshot.restore(
      resumePlan.space,
      resumePlan.sampler,
      settings.objectiveSpec,
      settings.stopMode,
      resumePlan.snapshot
    )

    return new ResumeExecutionSeed({
      optimizePlan,
      seed: new ExecuteSeed({
        initialTrials: Arr.fromIterable(seed.initialTrials),
        startTrialNumber: seed.startTrialNumber
      })
    })
  })

const storageLayerMissingFailure = () =>
  new InvalidStudyConfig({
    reason: "Study.resumeFromStorage requires StudyStorage layer"
  })

const snapshotMissingFailure = () =>
  new InvalidStudyConfig({
    reason: "Study.resumeFromStorage requires a persisted snapshot"
  })

const recoveredSnapshotFromStorage = Effect.serviceOption(StudyStorage.StudyStorage).pipe(
  Effect.flatMap(
    Option.match({
      onNone: () => Effect.fail(storageLayerMissingFailure()),
      onSome: (storage) =>
        Effect.gen(function*() {
          const snapshotOption = yield* storage.loadSnapshot()
          const snapshot = yield* Option.match(snapshotOption, {
            onNone: () => Effect.fail(snapshotMissingFailure()),
            onSome: Effect.succeed
          })
          const replayTail = yield* storage.replayTrialLog()

          return yield* StudySnapshot.recover(snapshot, replayTail)
        })
    })
  )
)

/**
 * @since 0.1.0
 * @category utils
 */
export const resumeExecutionSeedFromStorageOptions = <Space extends SearchSpace.SearchSpace>(
  options: ResumeFromStorageOptionsFromSpace<Space>
): Effect.Effect<ResumeExecutionSeed<SearchSpace.Type<Space>, Space>, SearchError, StudyStorage.StudyStorage> =>
  Effect.gen(function*() {
    const recoveredSnapshot = yield* recoveredSnapshotFromStorage
    const resumeOptions = resumeOptionsWithSnapshot(options, recoveredSnapshot)

    return yield* resumeExecutionSeedFromOptions(resumeOptions)
  })
