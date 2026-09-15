/**
 * Single-objective trial split — directional value normalization and constraint-aware partitioning.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Number as Num, Option } from "effect"

import type { Direction } from "../../../contracts/Direction.js"
import { CompletedTrialForSplit, splitTrials, type TrialSplit } from "../../../internal/tpe/splitTrials.js"
import type { SuggestContext } from "../../../Sampler/index.js"
import {
  ConstraintAwareSplitTrial,
  type ConstraintAwareSplitTrials,
  splitWithConstraintFeasibility
} from "../constraints/split.js"

const numericObjectiveValue = (value: unknown): Option.Option<number> =>
  Match.value(value).pipe(
    Match.when(Match.number, (resolved) => Option.some(resolved)),
    Match.orElse(() => Option.none())
  )

const directionalObjectiveValue = (direction: Direction, value: number): number =>
  Match.value(direction).pipe(
    Match.when("maximize", () => Num.negate(value)),
    Match.when("minimize", () => value),
    Match.exhaustive
  )

const asConstraintAwareSplitTrials = (
  completed: SuggestContext["completed"],
  direction: Direction
): ConstraintAwareSplitTrials =>
  Arr.flatMap(completed, (trial) =>
    numericObjectiveValue(trial.value).pipe(
      Option.match({
        onNone: () => Arr.empty<ConstraintAwareSplitTrial>(),
        onSome: (value) =>
          Arr.of(
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
                Option.getOrElse(() => Arr.empty<number>())
              )
            })
          )
      })
    ))

/**
 * Splits completed trials for single-objective TPE by normalizing values
 * according to the optimization direction and partitioning into below/above
 * groups with constraint-aware feasibility.
 *
 * The below group feeds the l(x) density estimator (promising region),
 * while the above group feeds g(x) (complement region).
 *
 * @see {@link splitMultiObjective} for multi-objective Pareto-based splitting
 * @since 0.1.0
 * @category sampling
 */
export const splitSingleObjective = (
  completed: SuggestContext["completed"],
  direction: Direction
): TrialSplit => {
  const trials = asConstraintAwareSplitTrials(completed, direction)

  return splitWithConstraintFeasibility(trials).pipe(
    Option.getOrElse(() => splitTrials(Arr.map(trials, (trial) => trial.trial)))
  )
}
