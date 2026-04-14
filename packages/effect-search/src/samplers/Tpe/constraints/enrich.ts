/**
 * Constraint enrichment — evaluates constraint functions on completed trials missing constraint scores.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Option } from "effect"

import { SuggestCompletedTrial } from "../../../Sampler/index.js"
import type { TpeConstraintEvaluator } from "../options.js"

const cloneWithConstraints = (
  trial: SuggestCompletedTrial,
  constraints: ReadonlyArray<number>
): SuggestCompletedTrial =>
  SuggestCompletedTrial.make({
    trialNumber: trial.trialNumber,
    config: trial.config,
    value: trial.value,
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
    ),
    constraints: [...constraints]
  })

const existingConstraints = (
  trial: SuggestCompletedTrial,
  constraintCount: number
): Option.Option<ReadonlyArray<number>> =>
  Option.fromNullable(trial.constraints).pipe(
    Option.filter((constraints) => constraints.length === constraintCount)
  )

const evaluateConstraintsForTrial = (
  trial: SuggestCompletedTrial,
  constraints: ReadonlyArray<TpeConstraintEvaluator>
): Effect.Effect<SuggestCompletedTrial> =>
  existingConstraints(trial, constraints.length).pipe(
    Option.match({
      onNone: () =>
        Effect.forEach(constraints, (evaluateConstraint) => evaluateConstraint(trial.config)).pipe(
          Effect.map((resolvedConstraints) => cloneWithConstraints(trial, resolvedConstraints))
        ),
      onSome: () => Effect.succeed(trial)
    })
  )

/**
 * Evaluates constraint functions on completed trials that lack constraint
 * scores, preserving already-scored trials unchanged. This lazy enrichment
 * avoids redundant constraint evaluation when trials already carry valid
 * constraint vectors from prior iterations.
 *
 * @see {@link TpeConstraintEvaluator} for the constraint function signature
 * @see {@link SuggestCompletedTrial} for the trial structure being enriched
 * @since 0.1.0
 * @category constructors
 */
export const enrichCompletedTrialsWithConstraints = (
  completed: ReadonlyArray<SuggestCompletedTrial>,
  constraints: ReadonlyArray<TpeConstraintEvaluator>
): Effect.Effect<ReadonlyArray<SuggestCompletedTrial>> =>
  Arr.head(constraints).pipe(
    Option.match({
      onNone: () => Effect.succeed(completed),
      onSome: () => Effect.forEach(completed, (trial) => evaluateConstraintsForTrial(trial, constraints))
    })
  )
