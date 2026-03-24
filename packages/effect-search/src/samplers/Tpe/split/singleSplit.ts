/**
 * Single-objective trial split — directional value normalization and constraint-aware partitioning.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Option } from "effect"

import type { Direction } from "../../../contracts/Direction.js"
import { CompletedTrialForSplit, splitTrials, type TrialSplit } from "../../../internal/tpe/splitTrials.js"
import type { SuggestCompletedTrial } from "../../../Sampler/index.js"
import { ConstraintAwareSplitTrial, splitWithConstraintFeasibility } from "../constraints/split.js"

const numericObjectiveValue = (value: unknown): Option.Option<number> =>
  Match.value(value).pipe(
    Match.when(Match.number, (resolved) => Option.some(resolved)),
    Match.orElse(() => Option.none())
  )

const directionalObjectiveValue = (direction: Direction, value: number): number =>
  Match.value(direction).pipe(
    Match.when("maximize", () => -value),
    Match.orElse(() => value)
  )

const asConstraintAwareSplitTrials = (
  completed: ReadonlyArray<SuggestCompletedTrial>,
  direction: Direction
): Array<ConstraintAwareSplitTrial> =>
  completed.flatMap((trial) =>
    numericObjectiveValue(trial.value).pipe(
      Option.match({
        onNone: () => [],
        onSome: (value) => [
          new ConstraintAwareSplitTrial({
            trial: new CompletedTrialForSplit({
              trialNumber: trial.trialNumber,
              config: trial.config,
              value: directionalObjectiveValue(direction, value),
              ...Option.fromNullable(trial.observationWeight).pipe(
                Option.match({
                  onNone: () => ({}),
                  onSome: (observationWeight) => ({ observationWeight })
                })
              ),
              ...Option.fromNullable(trial.cost).pipe(
                Option.match({
                  onNone: () => ({}),
                  onSome: (cost) => ({ cost })
                })
              ),
              ...Option.fromNullable(trial.variance).pipe(
                Option.match({
                  onNone: () => ({}),
                  onSome: (variance) => ({ variance })
                })
              )
            }),
            constraints: Option.fromNullable(trial.constraints).pipe(
              Option.getOrElse(() => [])
            )
          })
        ]
      })
    )
  )

/** @since 0.1.0 */
export const splitSingleObjective = (
  completed: ReadonlyArray<SuggestCompletedTrial>,
  direction: Direction
): TrialSplit => {
  const trials = asConstraintAwareSplitTrials(completed, direction)

  return splitWithConstraintFeasibility(trials).pipe(
    Option.getOrElse(() => splitTrials(Arr.map(trials, (trial) => trial.trial)))
  )
}
