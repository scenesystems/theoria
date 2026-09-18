/**
 * Resume seed construction from prior optimization snapshots or storage.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Number as Num, Option } from "effect"

import type * as Optimization from "../../Optimization.js"
import * as OptimizationSnapshot from "../../OptimizationSnapshot.js"
import * as OptimizationStorage from "../../OptimizationStorage.js"
import { InvalidOptimizationConfig, type SearchError } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
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
  options: Optimization.ResumeOptions<SearchSpace.Type<Space>, Space>
): Effect.Effect<ResumeExecutionSeed<SearchSpace.Type<Space>, Space>, SearchError> =>
  Effect.gen(function*() {
    const resumePlan = yield* resumePlanFromOptions(options)
    const optimizePlan = optimizePlanFromResume(resumePlan)
    const settings = normalizeSettings(optimizePlan)
    const seed = yield* OptimizationSnapshot.restore(
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
  new InvalidOptimizationConfig({
    reason: "Optimization.resumeFromStorage requires OptimizationStorage layer"
  })

const snapshotMissingFailure = () =>
  new InvalidOptimizationConfig({
    reason: "Optimization.resumeFromStorage requires a persisted snapshot"
  })

const recoveredSnapshotFromStorage = Effect.serviceOption(OptimizationStorage.OptimizationStorage).pipe(
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
          // Pin the replay boundary to this snapshot. Loading a second snapshot
          // after a concurrent append could discard trials absent from the first.
          const trialLog = yield* storage.loadTrialLog()
          const replayTail = Arr.filter(trialLog, (trial) =>
            Num.greaterThanOrEqualTo(trial.trialNumber, snapshot.nextTrialNumber))

          return yield* OptimizationSnapshot.recover(snapshot, replayTail)
        })
    })
  )
)

/**
 * @since 0.1.0
 * @category utils
 */
export const resumeExecutionSeedFromStorageOptions = <Space extends SearchSpace.SearchSpace>(
  options: Optimization.StorageResumeOptions<SearchSpace.Type<Space>, Space>
): Effect.Effect<
  ResumeExecutionSeed<SearchSpace.Type<Space>, Space>,
  SearchError,
  OptimizationStorage.OptimizationStorage
> =>
  Effect.gen(function*() {
    const recoveredSnapshot = yield* recoveredSnapshotFromStorage
    const resumeOptions = resumeOptionsWithSnapshot(options, recoveredSnapshot)

    return yield* resumeExecutionSeedFromOptions(resumeOptions)
  })
