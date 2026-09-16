/**
 * Final single- and multi-objective result values.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Match, Option } from "effect"

import { match } from "../../Objective.js"
import { NoSuccessfulTrials, type SearchError } from "../../SearchError.js"
import { MultiObjectiveResult, type Result, SingleObjectiveResult } from "../../Study.js"
import * as Trial from "../../Trial.js"
import { pickBestTrial } from "./best.js"
import { paretoFrontFromCompleted } from "./pareto.js"
import { type ExecuteOutcome } from "./runtime.js"

/**
 * Converts an ExecuteOutcome into a typed Result, selecting best trial (single) or Pareto front (multi).
 *
 * @since 0.1.0
 * @category constructors
 */
export const resultFromOutcome = <Config>(
  outcome: ExecuteOutcome<Config>
): Effect.Effect<Result<Config>, SearchError> =>
  match({
    Single: ({ direction }) =>
      Effect.gen(function*() {
        const numericCompleted = Arr.filter(
          outcome.completed,
          (trial): trial is Trial.NumericCompletedTrial<Config> => Trial.isNumericCompleted(trial)
        )
        const best = yield* Option.match(pickBestTrial(direction, numericCompleted), {
          onNone: () => Effect.fail(new NoSuccessfulTrials({ trialCount: Arr.length(outcome.trials) })),
          onSome: Effect.succeed
        })

        return new SingleObjectiveResult<Config>({
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
          Effect.fail(new NoSuccessfulTrials({ trialCount: Arr.length(outcome.trials) })),
          () => Arr.isEmptyArray(paretoFront)
        )

        return new MultiObjectiveResult<Config>({
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
  result: Result<Config>
): Effect.Effect<MultiObjectiveResult<Config>["paretoFront"]> =>
  Match.value(result).pipe(
    Match.tag("SingleObjective", ({ bestTrial }) => Effect.succeed(Arr.of(bestTrial))),
    Match.tag("MultiObjective", ({ paretoFront }) => Effect.succeed(paretoFront)),
    Match.exhaustive
  )
