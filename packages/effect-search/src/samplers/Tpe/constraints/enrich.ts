/**
 * Constraint enrichment — evaluates constraint functions on completed trials missing constraint scores.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Equal, Option, Schema } from "effect"

import { SuggestCompletedTrial, type SuggestContext } from "../../../Sampler/index.js"
import type { TpeConstraintEvaluators } from "../options.js"

const ConstraintScoresSchema = Schema.Array(Schema.Number)
type ConstraintScores = Schema.Schema.Type<typeof ConstraintScoresSchema>

const cloneWithConstraints = (
  trial: SuggestCompletedTrial,
  constraints: ConstraintScores
): SuggestCompletedTrial =>
  new SuggestCompletedTrial({
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
    constraints: Arr.fromIterable(constraints)
  })

const existingConstraints = (
  trial: SuggestCompletedTrial,
  constraintCount: number
): Option.Option<ConstraintScores> =>
  Option.fromNullable(trial.constraints).pipe(
    Option.filter((constraints) => Equal.equals(Arr.length(constraints), constraintCount))
  )

const evaluateConstraintsForTrial = (
  trial: SuggestCompletedTrial,
  constraints: TpeConstraintEvaluators
): Effect.Effect<SuggestCompletedTrial> =>
  existingConstraints(trial, Arr.length(constraints)).pipe(
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
  completed: SuggestContext["completed"],
  constraints: TpeConstraintEvaluators
): Effect.Effect<SuggestContext["completed"]> =>
  Arr.head(constraints).pipe(
    Option.match({
      onNone: () => Effect.succeed(completed),
      onSome: () => Effect.forEach(completed, (trial) => evaluateConstraintsForTrial(trial, constraints))
    })
  )
