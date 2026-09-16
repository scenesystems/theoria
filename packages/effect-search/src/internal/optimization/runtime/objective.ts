/**
 * Optimization objective outcome classification and value validation.
 *
 * @since 0.1.0
 */
import type { Exit } from "effect"
import {
  Array as Arr,
  Boolean as Bool,
  Cause,
  Data,
  Effect,
  Inspectable,
  Match,
  Number as Num,
  Option,
  Schema
} from "effect"

import { match, type Objective } from "../../../Objective.js"
import { dimensionCount, isFiniteValue, type Value } from "../../../Objective.js"
import type { Pruned } from "../../../Pruning.js"
import { InvalidObjectiveValue, TrialError } from "../../../SearchError.js"
import * as Trial from "../../../Trial.js"

const isObjectiveCompatibleWithSpec = (objectiveSpec: Objective, value: Value): boolean =>
  match({
    Single: () =>
      Match.value(value).pipe(
        Match.when(Match.number, Schema.is(Schema.JsonNumber)),
        Match.orElse(() => false)
      ),
    Multi: ({ directions }) =>
      Bool.and(isFiniteValue(value), Num.Equivalence(dimensionCount(value), Arr.length(directions)))
  })(objectiveSpec)

const messageFromCause = (cause: unknown): string =>
  Schema.decodeUnknownOption(Schema.Struct({ message: Schema.String }))(cause).pipe(
    Option.map(({ message }) => message),
    Option.getOrElse(() => Inspectable.toStringUnknown(cause))
  )

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

const invalidValueFailure = (trialNumber: number, value: Value): TrialError =>
  objectiveFailure(
    trialNumber,
    new InvalidObjectiveValue({
      trialNumber,
      value
    })
  )

const isTrialError = Schema.is(TrialError)

/**
 * The error a failed trial records. A cause that is exactly one trial failure is
 * that failure; anything else, such as a trial failure followed by a finalizer
 * defect, alongside an interruption, or a defect on its own, is recorded whole
 * so nothing the objective did on its way out is lost.
 */
const trialErrorFromFailure = (trialNumber: number, cause: Cause.Cause<unknown>): TrialError =>
  Match.value(cause).pipe(
    Match.when({ _tag: "Fail", error: isTrialError }, ({ error }) => error),
    Match.orElse(() =>
      Cause.failureOption(cause).pipe(
        Option.filter(isTrialError),
        Option.match({
          onNone: () => objectiveFailure(trialNumber, cause),
          onSome: (error) => new TrialError({ trialNumber, message: error.message, cause })
        })
      )
    )
  )

const withEvaluationMetadata = <Config>(
  trial: Trial.Trial<Config>,
  evaluationCount: number,
  variance: Option.Option<number>
): Trial.Trial<Config> =>
  Trial.matchState({
    Running: () => trial,
    Failed: () => trial,
    Pruned: () => trial,
    Cancelled: () => trial,
    Completed: (state) =>
      Data.struct({
        ...trial,
        state: Trial.Completed({
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
  running: Trial.Trial<Config>,
  objectiveSpec: Objective,
  trialNumber: number,
  finishedAt: number,
  objectiveExit: Exit.Exit<Value, unknown>,
  retryCount = 0,
  cost: Option.Option<number> = Option.none(),
  evaluationCount = 1,
  variance: Option.Option<number> = Option.none()
): Effect.Effect<Trial.Trial<Config>> =>
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
              invalidValueFailure(trialNumber, value),
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
  running: Trial.Trial<Config>,
  objectiveSpec: Objective,
  trialNumber: number,
  finishedAt: number,
  objectiveExit: Exit.Exit<Value, unknown>,
  pruned: Option.Option<Pruned>,
  retryCount = 0,
  cost: Option.Option<number> = Option.none(),
  evaluationCount = 1,
  variance: Option.Option<number> = Option.none()
): Effect.Effect<Trial.Trial<Config>> =>
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
