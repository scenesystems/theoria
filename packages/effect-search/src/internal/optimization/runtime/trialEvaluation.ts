/**
 * Optimization trial evaluation with retry, timeout, and aggregation orchestration.
 *
 * @since 0.1.0
 */
import * as Journal from "@scenesystems/effect-study/Journal"
import { Array as Arr, Cause, Chunk, Effect, Exit, Match, Option, Schema } from "effect"

import { type TrialError } from "../../../SearchError.js"
import type * as SearchSpace from "../../../SearchSpace.js"
import type * as Trial from "../../../Trial.js"
import type { OptimizePlan, OptimizeSettings } from "../options/plan.js"
import type { OptimizationRuntime } from "./bootstrap.js"
import { evaluateObjectiveWithTimeout } from "./objectiveTimeout.js"
import type { TrialContext } from "./trialContext.js"
import { aggregateObjectiveSamples } from "./trialEvaluation/aggregation.js"
import { type CacheResolveForTrial, ObjectiveAttempt } from "./trialEvaluation/outcome.js"
import { evaluateObjectiveWithRetry } from "./trialEvaluation/retry.js"

export { ObjectiveAttempt }

type ConfigFor<Space extends SearchSpace.SearchSpace> = SearchSpace.Type<Space>

const isJournalFailure = Schema.is(Journal.Failure)

const evaluateObjectiveWithAveraging = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  trialNumber: number,
  runtime: OptimizationRuntime<ConfigFor<Space>>,
  running: Trial.Trial<ConfigFor<Space>>,
  trialContext: TrialContext,
  resolveCachedValue: CacheResolveForTrial<Space["schema"]>
): Effect.Effect<ObjectiveAttempt, TrialError | Journal.Failure> =>
  Effect.forEach(
    Arr.makeBy(settings.evaluationsPerTrial, (index) => index),
    () =>
      evaluateObjectiveWithRetry(
        options,
        settings,
        trialNumber,
        runtime,
        running,
        trialContext,
        resolveCachedValue
      )
  ).pipe(
    Effect.flatMap((samples) => aggregateObjectiveSamples(trialNumber, samples))
  )

/**
 * A trial's exit records what the objective did. Failing to persist an envelope during
 * the trial is the optimization's failure, not the trial's, so it leaves the exit and takes the
 * error channel while preserving the complete cause, including any trial failures,
 * defects, or interruptions.
 */
const liftStorageFailure = (
  exit: Exit.Exit<ObjectiveAttempt, TrialError | Journal.Failure>
): Effect.Effect<Exit.Exit<ObjectiveAttempt, TrialError>, TrialError | Journal.Failure> =>
  Exit.match(exit, {
    onSuccess: (attempt) => Effect.succeed(Exit.succeed(attempt)),
    onFailure: (cause) =>
      Chunk.findFirst(Cause.failures(cause), isJournalFailure).pipe(
        Option.match({
          onSome: () => Effect.failCause(cause),
          onNone: () =>
            Effect.succeed(
              Exit.failCause(
                Cause.flatMap(cause, (error) =>
                  Match.value(error).pipe(
                    Match.tag("effect-search/TrialError", (trial) => Cause.fail(trial)),
                    // Unreachable: every Journal.Failure was found above.
                    Match.tag("effect-study/JournalError", (storage) => Cause.die(storage)),
                    Match.exhaustive
                  ))
              )
            )
        })
      )
  })

/**
 * Evaluates the objective function with multi-evaluation averaging, caching, and optional timeout, returning the exit as an Option.
 *
 * @since 0.1.0
 * @category utils
 */
export const evaluateObjectiveWithPolicy = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  trialNumber: number,
  runtime: OptimizationRuntime<ConfigFor<Space>>,
  running: Trial.Trial<ConfigFor<Space>>,
  trialContext: TrialContext,
  resolveCachedValue: CacheResolveForTrial<Space["schema"]>
): Effect.Effect<
  Option.Option<Exit.Exit<ObjectiveAttempt, TrialError>>,
  TrialError | Journal.Failure,
  never
> => {
  const objectiveEffect = evaluateObjectiveWithAveraging(
    options,
    settings,
    trialNumber,
    runtime,
    running,
    trialContext,
    resolveCachedValue
  )

  return Option.fromNullable(settings.trialTimeout).pipe(
    Option.match({
      onNone: () => objectiveEffect.pipe(Effect.exit, Effect.asSome),
      onSome: (trialTimeout) => evaluateObjectiveWithTimeout(objectiveEffect, trialTimeout)
    }),
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.succeedNone,
        onSome: (exit) => liftStorageFailure(exit).pipe(Effect.asSome)
      })
    )
  )
}
