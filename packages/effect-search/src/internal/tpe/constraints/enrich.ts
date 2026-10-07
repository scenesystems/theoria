/**
 * Constraint enrichment — evaluates constraint functions on completed trials missing constraint scores.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Equal, Option } from "effect"

import type { Vector } from "../../../Objective.js"
import { type Constraint, Observation, type PrunedObservation } from "../../../Sampler.js"

/**
 * A pruned trial with the constraint residuals evaluated on its configuration.
 * An empty vector means constraints are disabled.
 *
 * @since 0.9.0
 * @category models
 */
export class ConstrainedPrunedObservation extends Data.Class<{
  readonly trial: PrunedObservation
  readonly constraints: Vector
}> {}

const cloneWithConstraints = (
  trial: Observation,
  constraintsInput: Iterable<number>
): Observation => {
  const constraints = Arr.fromIterable(constraintsInput)
  return new Observation({
    trialNumber: trial.trialNumber,
    config: trial.config,
    value: trial.value,
    ...Option.fromNullishOr(trial.observationWeight).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (observationWeight) => ({ observationWeight })
      })
    ),
    ...Option.fromNullishOr(trial.cost).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (cost) => ({ cost })
      })
    ),
    ...Option.fromNullishOr(trial.variance).pipe(
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
  Option.fromNullishOr(trial.constraints).pipe(
    Option.filter((constraints) => Equal.equals(Arr.length(constraints), constraintCount))
  )

const evaluateConstraintsForTrial = (
  trial: Observation,
  constraintsInput: Iterable<Constraint>
): Effect.Effect<Observation> => {
  const constraints = Arr.fromIterable(constraintsInput)

  const materialized = Arr.fromIterable(constraints)

  return existingConstraints(trial, Arr.length(materialized)).pipe(
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

/**
 * Evaluates constraint functions on pruned trial configurations. Optuna records
 * `constraints_func` results for COMPLETE and PRUNED trials alike, so feasible
 * pruned trials rank ahead of infeasible trials.
 *
 * @since 0.9.0
 * @category constructors
 */
export const enrichPrunedTrialsWithConstraints = (
  prunedInput: Iterable<PrunedObservation>,
  constraintsInput: Iterable<Constraint>
): Effect.Effect<Array<ConstrainedPrunedObservation>> => {
  const constraints = Arr.fromIterable(constraintsInput)
  return Effect.forEach(
    Arr.fromIterable(prunedInput),
    (trial) =>
      Effect.forEach(constraints, (evaluateConstraint) => evaluateConstraint(trial.config)).pipe(
        Effect.map((resolved) => new ConstrainedPrunedObservation({ trial, constraints: resolved }))
      )
  )
}
