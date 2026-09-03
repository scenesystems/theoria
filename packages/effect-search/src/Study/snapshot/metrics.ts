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
 * Decodes sampler counts and checkpoint identity derived for a study snapshot.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SamplerMetricsSchema = Schema.Struct({
  /** Variant tag of the persisted sampler checkpoint. */
  checkpointTag: Schema.String,
  /** Completed-trial count supplied by snapshot construction. */
  completedCount: Schema.Number,
  /** Total retries recorded by completed trials. */
  retryCountTotal: Schema.Number,
  /** Number of persisted warm-start trials. */
  priorCount: Schema.Number
})

/**
 * Sampler diagnostics derived from the snapshot's trials and checkpoint.
 *
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
 * Sums the millisecond durations retained by terminal trial states.
 * Running and cancelled states contribute zero.
 *
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

/**
 * Derives checkpoint identity, completed count, retries, and warm-start count
 * for snapshot diagnostics.
 *
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
  retryCountTotal: retryCountTotalFromTrials(trials),
  priorCount: priorCountFromTrials(trials)
})
