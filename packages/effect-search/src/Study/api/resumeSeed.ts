/**
 * Resume seed construction from prior study snapshots or storage.
 *
 * @since 0.1.0
 */
import { Data, Effect, Option } from "effect"

import { InvalidStudyConfig, type SearchError } from "../../Errors/index.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import {
  normalizeSettings,
  type OptimizePlan,
  optimizePlanFromResume,
  type ResumeFromStorageOptionsFromSpace,
  type ResumeOptionsFromSpace,
  resumeOptionsWithSnapshot,
  resumePlanFromOptions
} from "../options.js"
import { type ExecuteSeed } from "../runtime.js"
import { SnapshotCodec } from "../services.js"
import { recoverSnapshotWithReplayTail } from "../snapshot/recovery.js"
import { StudyStorage } from "../studyStorage.js"

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
): Effect.Effect<ResumeExecutionSeed<SearchSpace.Type<Space>, Space>, SearchError, SnapshotCodec> =>
  Effect.gen(function*() {
    const resumePlan = yield* resumePlanFromOptions(options)
    const snapshotCodec = yield* SnapshotCodec
    const optimizePlan = optimizePlanFromResume(resumePlan)
    const settings = normalizeSettings(optimizePlan)
    const seed = yield* snapshotCodec.restore(
      resumePlan.space,
      resumePlan.sampler,
      settings.objectiveSpec,
      settings.stopMode,
      resumePlan.snapshot
    )

    return new ResumeExecutionSeed({ optimizePlan, seed })
  })

const storageLayerMissingFailure = () =>
  new InvalidStudyConfig({
    reason: "Study.resumeFromStorage requires StudyStorage layer"
  })

const snapshotMissingFailure = () =>
  new InvalidStudyConfig({
    reason: "Study.resumeFromStorage requires a persisted snapshot"
  })

const recoveredSnapshotFromStorage = Effect.serviceOption(StudyStorage).pipe(
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

          return yield* recoverSnapshotWithReplayTail(snapshot, replayTail)
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
): Effect.Effect<ResumeExecutionSeed<SearchSpace.Type<Space>, Space>, SearchError, SnapshotCodec | StudyStorage> =>
  Effect.gen(function*() {
    const recoveredSnapshot = yield* recoveredSnapshotFromStorage
    const resumeOptions = resumeOptionsWithSnapshot(options, recoveredSnapshot)

    return yield* resumeExecutionSeedFromOptions(resumeOptions)
  })
