/**
 * Trial objective evaluation with retry, timeout, and aggregation orchestration.
 *
 * @since 0.1.0
 */
import { Array as Arr, Cause, Chunk, Effect, Exit, Match, Option, Schema } from "effect"

import { ArtifactStorageError, type TrialError } from "../../Errors/index.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import type * as Trial from "../../Trial/index.js"
import type { ObjectiveEvaluator } from "../objectiveEvaluator.js"
import type { OptimizePlan, OptimizeSettings } from "../options.js"
import { evaluateObjectiveWithTimeout } from "./objectiveTimeout.js"
import type { StudyRuntime } from "./runtimeState.js"
import type { TrialContext } from "./trialContext.js"
import { aggregateObjectiveSamples } from "./trialEvaluation/aggregation.js"
import { type CacheResolveForTrial, ObjectiveAttempt } from "./trialEvaluation/model.js"
import { evaluateObjectiveWithRetry } from "./trialEvaluation/retry.js"

export { ObjectiveAttempt }

type ConfigFor<Space extends SearchSpace.SearchSpace> = SearchSpace.Type<Space>

const isArtifactStorageError = Schema.is(ArtifactStorageError)

const evaluateObjectiveWithAveraging = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  trialNumber: number,
  runtime: StudyRuntime<ConfigFor<Space>>,
  running: Trial.Trial<ConfigFor<Space>>,
  trialContext: TrialContext,
  resolveCachedValue: CacheResolveForTrial
): Effect.Effect<ObjectiveAttempt, TrialError | ArtifactStorageError, ObjectiveEvaluator> =>
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
 * the trial is the study's failure, not the trial's, so it leaves the exit and takes the
 * error channel; the rest of the cause (trial failures, defects, interruptions) is kept
 * intact rather than rebuilt from its first failure.
 */
const liftStorageFailure = (
  exit: Exit.Exit<ObjectiveAttempt, TrialError | ArtifactStorageError>
): Effect.Effect<Exit.Exit<ObjectiveAttempt, TrialError>, ArtifactStorageError> =>
  Exit.match(exit, {
    onSuccess: (attempt) => Effect.succeed(Exit.succeed(attempt)),
    onFailure: (cause) =>
      Chunk.findFirst(Cause.failures(cause), isArtifactStorageError).pipe(
        Option.match({
          onSome: (storage) => Effect.fail(storage),
          onNone: () =>
            Effect.succeed(
              Exit.failCause(
                Cause.flatMap(cause, (error) =>
                  Match.value(error).pipe(
                    Match.tag("effect-search/TrialError", (trial) => Cause.fail(trial)),
                    // Unreachable: every ArtifactStorageError was found above.
                    Match.tag("effect-search/ArtifactStorageError", (storage) => Cause.die(storage)),
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
  runtime: StudyRuntime<ConfigFor<Space>>,
  running: Trial.Trial<ConfigFor<Space>>,
  trialContext: TrialContext,
  resolveCachedValue: CacheResolveForTrial
): Effect.Effect<Option.Option<Exit.Exit<ObjectiveAttempt, TrialError>>, ArtifactStorageError, ObjectiveEvaluator> => {
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
      onNone: () => objectiveEffect.pipe(Effect.exit, Effect.map(Option.some)),
      onSome: (trialTimeout) => evaluateObjectiveWithTimeout(objectiveEffect, trialTimeout)
    }),
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.succeed(Option.none()),
        onSome: (exit) => liftStorageFailure(exit).pipe(Effect.map(Option.some))
      })
    )
  )
}
