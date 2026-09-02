/**
 * Final single- and multi-objective result values.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Option } from "effect"

import { matchObjectiveSpec } from "../../contracts/ObjectiveSpec.js"
import { NoSuccessfulTrials, type SearchError } from "../../Errors/index.js"
import type * as Scheduler from "../../Scheduler/index.js"
import type * as StudyEvent from "../../StudyEvent/index.js"
import * as Trial from "../../Trial/index.js"
import { pickBestTrial } from "../best.js"
import { paretoFrontFromCompleted } from "../pareto.js"
import { type ExecuteOutcome } from "../runtime.js"
import { type SnapshotMetadata } from "../snapshot/metadata.js"

/**
 * Retains the earliest trial with the best scalar value and all study trials
 * in trial-number order. Construction fails with `NoSuccessfulTrials` when no
 * completed scalar result exists.
 *
 * @typeParam Config - Decoded search-space configuration retained by each trial.
 *
 * @since 0.1.0
 * @category models
 */
export class SingleObjectiveResult<Config = unknown> extends Data.Class<{
  /** Discriminator for exhaustive result matching. */
  readonly _tag: "SingleObjective"
  /** Compatibility data needed to create and validate a resume snapshot. */
  readonly snapshotMetadata: SnapshotMetadata
  /** Best completed scalar trial; equal values retain the earlier trial. */
  readonly bestTrial: Trial.NumericCompletedTrial<Config>
  /** Running and terminal trials sorted by trial number. */
  readonly trials: Array<Trial.Trial<Config>>
  /** Condition that stopped admission of new trials. */
  readonly completionReason: StudyEvent.CompletionReason
  /** Bracket and round results, present only for scheduled execution. */
  readonly schedulerSummary?: Scheduler.SchedulerSummary
}> {}

/**
 * Retains the epsilon-aware non-dominated trials and all study trials in
 * trial-number order. The Pareto front is also sorted by trial number.
 * Construction fails with `NoSuccessfulTrials` when the front is empty.
 *
 * @typeParam Config - Decoded search-space configuration retained by each trial.
 *
 * @since 0.1.0
 * @category models
 */
export class MultiObjectiveResult<Config = unknown> extends Data.Class<{
  /** Discriminator for exhaustive result matching. */
  readonly _tag: "MultiObjective"
  /** Compatibility data needed to create and validate a resume snapshot. */
  readonly snapshotMetadata: SnapshotMetadata
  /** Non-dominated completed trials under the requested directions and epsilon. */
  readonly paretoFront: Array<Trial.CompletedTrial<Config>>
  /** Running and terminal trials sorted by trial number. */
  readonly trials: Array<Trial.Trial<Config>>
  /** Condition that stopped admission of new trials. */
  readonly completionReason: StudyEvent.CompletionReason
  /** Bracket and round results, present only for scheduled execution. */
  readonly schedulerSummary?: Scheduler.SchedulerSummary
}> {}

/**
 * Selects the result shape from the study's objective specification while
 * preserving the search-space configuration type.
 *
 * @typeParam Config - Decoded search-space configuration retained by each trial.
 *
 * @since 0.1.0
 * @category type-level
 */
export type StudyResult<Config = unknown> = SingleObjectiveResult<Config> | MultiObjectiveResult<Config>

/**
 * Converts an ExecuteOutcome into a typed StudyResult, selecting best trial (single) or Pareto front (multi).
 *
 * @since 0.1.0
 * @category constructors
 */
export const studyResultFromOutcome = <Config>(
  outcome: ExecuteOutcome<Config>
): Effect.Effect<StudyResult<Config>, SearchError> =>
  matchObjectiveSpec({
    Single: ({ direction }) =>
      Effect.gen(function*() {
        const numericCompleted = Arr.filter(
          outcome.completed,
          (trial): trial is Trial.NumericCompletedTrial<Config> => Trial.isNumericCompletedTrial(trial)
        )
        const best = yield* Option.match(pickBestTrial(direction, numericCompleted), {
          onNone: () => Effect.fail(new NoSuccessfulTrials({ trialCount: outcome.trials.length })),
          onSome: Effect.succeed
        })

        return new SingleObjectiveResult<Config>({
          _tag: "SingleObjective",
          snapshotMetadata: outcome.snapshotMetadata,
          bestTrial: best,
          trials: outcome.trials,
          completionReason: outcome.completionReason,
          ...Option.fromNullable(outcome.schedulerSummary).pipe(
            Option.match({
              onNone: () => ({}),
              onSome: (schedulerSummary) => ({ schedulerSummary })
            })
          )
        })
      }),
    Multi: ({ directions }) =>
      Effect.gen(function*() {
        const paretoFront = paretoFrontFromCompleted(outcome.completed, directions, outcome.epsilon)

        yield* Effect.when(
          Effect.fail(new NoSuccessfulTrials({ trialCount: outcome.trials.length })),
          () => paretoFront.length <= 0
        )

        return new MultiObjectiveResult<Config>({
          _tag: "MultiObjective",
          snapshotMetadata: outcome.snapshotMetadata,
          paretoFront,
          trials: outcome.trials,
          completionReason: outcome.completionReason,
          ...Option.fromNullable(outcome.schedulerSummary).pipe(
            Option.match({
              onNone: () => ({}),
              onSome: (schedulerSummary) => ({ schedulerSummary })
            })
          )
        })
      })
  })(outcome.objectiveSpec)

/**
 * Returns the stored Pareto front for a multi-objective result. A
 * single-objective result is represented as a one-element front containing its
 * best trial. The returned Effect cannot fail and requires no services.
 *
 * @typeParam Config - Decoded configuration retained by the returned trials.
 *
 * @since 0.1.0
 * @category combinators
 */
export const pareto = <Config>(
  result: StudyResult<Config>
): Effect.Effect<Array<Trial.CompletedTrial<Config>>> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial }) => Effect.succeed(Arr.of(bestTrial))),
    Match.tag("MultiObjective", ({ paretoFront }) => Effect.succeed(paretoFront)),
    Match.exhaustive
  )
