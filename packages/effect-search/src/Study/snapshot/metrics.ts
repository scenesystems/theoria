/**
 * Derived sampler metrics and duration computations for study snapshots.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Number as Num, Option, Schema } from "effect"

import type { SamplerCheckpoint } from "../../Sampler/index.js"
import type { SnapshotTrial, TrialStateSnapshot } from "./stateCodec.js"
import { stateDuration } from "./stateCodec.js"

/**
 * Derived sampler metadata persisted in v2 snapshots.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SamplerMetricsSchema = Schema.Struct({
  checkpointTag: Schema.String,
  completedCount: Schema.Number,
  pendingCount: Schema.Number,
  retryCountTotal: Schema.Number,
  priorCount: Schema.Number
})

/**
 * @since 0.1.0
 * @category type-level
 */
export type SamplerMetrics = Schema.Schema.Type<typeof SamplerMetricsSchema>

const retryCountFromState = (state: TrialStateSnapshot): number =>
  Match.value(state).pipe(
    Match.tag("Completed", ({ retryCount }) => Option.fromNullable(retryCount).pipe(Option.getOrElse(() => 0))),
    Match.orElse(() => 0)
  )

/**
 * @since 0.1.0
 * @category utils
 */
export const studyDurationFromTrials = (trials: ReadonlyArray<SnapshotTrial>): number =>
  Arr.reduce(trials, 0, (total, trial) => Num.sum(total, stateDuration(trial.state)))

const retryCountTotalFromTrials = (trials: ReadonlyArray<SnapshotTrial>): number =>
  Arr.reduce(trials, 0, (total, trial) => Num.sum(total, retryCountFromState(trial.state)))

const priorCountFromTrials = (trials: ReadonlyArray<SnapshotTrial>): number =>
  Arr.reduce(
    trials,
    0,
    (count, trial) =>
      Match.value(trial.prior).pipe(
        Match.when(true, () => Num.increment(count)),
        Match.orElse(() => count)
      )
  )

const pendingCountFromTrials = (trials: ReadonlyArray<SnapshotTrial>): number =>
  Arr.reduce(
    trials,
    0,
    (count, trial) =>
      Match.value(trial.state._tag).pipe(
        Match.when("Running", () => Num.increment(count)),
        Match.orElse(() => count)
      )
  )

/**
 * @since 0.1.0
 * @category constructors
 */
export const samplerMetricsFromTrials = (
  trials: ReadonlyArray<SnapshotTrial>,
  samplerCheckpoint: SamplerCheckpoint,
  completedCount: number
): SamplerMetrics => ({
  checkpointTag: samplerCheckpoint._tag,
  completedCount,
  pendingCount: pendingCountFromTrials(trials),
  retryCountTotal: retryCountTotalFromTrials(trials),
  priorCount: priorCountFromTrials(trials)
})
