/**
 * Objective evaluation outcome classification and value validation.
 *
 * @since 0.1.0
 */
import type { Exit } from "effect"
import { Cause, Effect, Match, Option, Predicate, Schema } from "effect"

import { matchObjectiveSpec, type ObjectiveSpec } from "../../contracts/ObjectiveSpec.js"
import { isFiniteObjectiveValue, objectiveDimensionCount, type ObjectiveValue } from "../../contracts/ObjectiveValue.js"
import { InvalidObjectiveValue, TrialError } from "../../Errors/index.js"
import { Completed, matchState, Trial } from "../../Trial/index.js"

import type { PrunedDecision } from "./pruning.js"

const isObjectiveCompatibleWithSpec = (objectiveSpec: ObjectiveSpec, value: ObjectiveValue): boolean =>
  matchObjectiveSpec({
    Single: () =>
      Match.value(value).pipe(
        Match.when(Match.number, (entry) => Number.isFinite(entry)),
        Match.orElse(() => false)
      ),
    Multi: ({ directions }) => isFiniteObjectiveValue(value) && objectiveDimensionCount(value) === directions.length
  })(objectiveSpec)

const messageFromCause = (cause: unknown): string =>
  (Predicate.isRecord(cause) &&
      Predicate.hasProperty(cause, "message") &&
      Predicate.isString(cause.message))
    ? cause.message
    : String(cause)

/**
 * Wraps an arbitrary failure cause into a TrialError for the given trial number.
 *
 * @since 0.1.0
 * @category constructors
 */
export const objectiveFailure = (trialNumber: number, cause: unknown): TrialError =>
  new TrialError({
    trialNumber,
    message: messageFromCause(cause),
    cause
  })

const invalidObjectiveValueFailure = (trialNumber: number, value: ObjectiveValue): TrialError =>
  objectiveFailure(
    trialNumber,
    new InvalidObjectiveValue({
      trialNumber,
      value
    })
  )

const isTrialError = Schema.is(TrialError)

const trialErrorFromFailure = (trialNumber: number, cause: Cause.Cause<unknown>): TrialError =>
  Cause.failureOption(cause).pipe(
    Option.getOrElse(() => cause),
    (resolvedCause) =>
      isTrialError(resolvedCause)
        ? resolvedCause
        : objectiveFailure(trialNumber, resolvedCause)
  )

const withEvaluationMetadata = <Config>(
  trial: Trial<Config>,
  evaluationCount: number,
  variance: Option.Option<number>
): Trial<Config> =>
  matchState({
    Running: () => trial,
    Failed: () => trial,
    Pruned: () => trial,
    Cancelled: () => trial,
    Completed: (state) =>
      new Trial({
        ...trial,
        state: Completed({
          ...state,
          evaluationCount,
          ...variance.pipe(
            Option.match({
              onNone: () => ({}),
              onSome: (resolvedVariance) => ({ variance: resolvedVariance })
            })
          )
        })
      })
  })(trial.state)

/**
 * Converts an objective evaluation exit into a terminal trial state (Completed or Failed), validating value compatibility with the objective spec.
 *
 * @since 0.1.0
 * @category utils
 */
export const finalizeTrial = <Config>(
  running: Trial<Config>,
  objectiveSpec: ObjectiveSpec,
  trialNumber: number,
  finishedAt: number,
  objectiveExit: Exit.Exit<ObjectiveValue, unknown>,
  retryCount = 0,
  cost: Option.Option<number> = Option.none(),
  evaluationCount = 1,
  variance: Option.Option<number> = Option.none()
): Effect.Effect<Trial<Config>> =>
  Match.value(objectiveExit).pipe(
    Match.tag("Success", ({ value }) =>
      Match.value(isObjectiveCompatibleWithSpec(objectiveSpec, value)).pipe(
        Match.when(
          true,
          () =>
            Effect.succeed(
              withEvaluationMetadata(
                Trial.completeWithRetryCountAndCost(running, value, finishedAt, retryCount, cost),
                evaluationCount,
                variance
              )
            )
        ),
        Match.orElse(() =>
          Effect.succeed(
            Trial.fail(
              running,
              invalidObjectiveValueFailure(trialNumber, value),
              finishedAt
            )
          )
        )
      )),
    Match.tag("Failure", ({ cause }) =>
      Effect.succeed(
        Trial.fail(
          running,
          trialErrorFromFailure(trialNumber, cause),
          finishedAt
        )
      )),
    Match.exhaustive
  )

/**
 * Finalizes a trial, applying a pruning decision if present — pruned trials bypass objective value validation.
 *
 * @since 0.1.0
 * @category utils
 */
export const finalizeTrialWithPrune = <Config>(
  running: Trial<Config>,
  objectiveSpec: ObjectiveSpec,
  trialNumber: number,
  finishedAt: number,
  objectiveExit: Exit.Exit<ObjectiveValue, unknown>,
  pruned: Option.Option<PrunedDecision>,
  retryCount = 0,
  cost: Option.Option<number> = Option.none(),
  evaluationCount = 1,
  variance: Option.Option<number> = Option.none()
): Effect.Effect<Trial<Config>> =>
  Option.match(pruned, {
    onNone: () =>
      finalizeTrial(
        running,
        objectiveSpec,
        trialNumber,
        finishedAt,
        objectiveExit,
        retryCount,
        cost,
        evaluationCount,
        variance
      ),
    onSome: ({ step, reason, policy }) => Effect.succeed(Trial.prune(running, step, reason, policy, finishedAt))
  })
