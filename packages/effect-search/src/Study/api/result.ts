/**
 * Study result construction from completed trials and execution outcomes.
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
 * Result of a single-objective optimization study.
 *
 * @since 0.1.0
 * @category models
 */
export class SingleObjectiveResult<Config = unknown> extends Data.Class<{
  readonly _tag: "SingleObjective"
  readonly snapshotMetadata: SnapshotMetadata
  readonly bestTrial: Trial.NumericCompletedTrial<Config>
  readonly trials: Array<Trial.Trial<Config>>
  readonly completionReason: StudyEvent.CompletionReason
  readonly schedulerSummary?: Scheduler.SchedulerSummary
}> {}

/**
 * Result of a multi-objective optimization study.
 *
 * @since 0.1.0
 * @category models
 */
export class MultiObjectiveResult<Config = unknown> extends Data.Class<{
  readonly _tag: "MultiObjective"
  readonly snapshotMetadata: SnapshotMetadata
  readonly paretoFront: Array<Trial.CompletedTrial<Config>>
  readonly trials: Array<Trial.Trial<Config>>
  readonly completionReason: StudyEvent.CompletionReason
  readonly schedulerSummary?: Scheduler.SchedulerSummary
}> {}

/**
 * Union of single and multi-objective results.
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
 * Extract the Pareto front from a study result.
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
