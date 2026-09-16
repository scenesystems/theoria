/**
 * Constraint enrichment — evaluates constraint functions on completed trials missing constraint scores.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Equal, Option } from "effect"

import { type Constraint, Observation } from "../../../Sampler.js"

const cloneWithConstraints = (
  trial: Observation,
  constraintsInput: Iterable<number>
): Observation => {
  const constraints = Arr.fromIterable(constraintsInput)
  return new Observation({
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
}

const existingConstraints = (
  trial: Observation,
  constraintCount: number
) =>
  Option.fromNullable(trial.constraints).pipe(
    Option.filter((constraints) => Equal.equals(constraints.length, constraintCount))
  )

const evaluateConstraintsForTrial = (
  trial: Observation,
  constraintsInput: Iterable<Constraint>
): Effect.Effect<Observation> => {
  const constraints = Arr.fromIterable(constraintsInput)

  const materialized = Arr.fromIterable(constraints)

  return existingConstraints(trial, materialized.length).pipe(
    Option.match({
      onNone: () =>
        Effect.forEach(materialized, (evaluateConstraint) => evaluateConstraint(trial.config)).pipe(
          Effect.map((resolvedConstraints) => cloneWithConstraints(trial, resolvedConstraints))
        ),
      onSome: () => Effect.succeed(trial)
    })
  )
}

/**
 * Evaluates constraint functions on completed trials that lack constraint
 * scores, preserving already-scored trials unchanged. This lazy enrichment
 * avoids redundant constraint evaluation when trials already carry valid
 * constraint vectors from prior iterations.
 *
 * @see {@link TpeConstraintEvaluator} for the constraint function signature
 * @see {@link Observation} for the trial structure being enriched
 * @since 0.1.0
 * @category constructors
 */
export const enrichCompletedTrialsWithConstraints = (
  completedInput: Iterable<Observation>,
  constraintsInput: Iterable<Constraint>
) => {
  const completed = Arr.fromIterable(completedInput)
  const constraints = Arr.fromIterable(constraintsInput)

  const materialized = Arr.fromIterable(constraints)

  return Arr.head(materialized).pipe(
    Option.match({
      onNone: () => Effect.succeed(Arr.fromIterable(completed)),
      onSome: () => Effect.forEach(completed, (trial) => evaluateConstraintsForTrial(trial, materialized))
    })
  )
}
