/**
 * Trial objective evaluation with retry, timeout, and aggregation orchestration.
 *
 * @since 0.1.0
 */
import type { Exit } from "effect"
import { Array as Arr, Effect, Option } from "effect"

import type { TrialError } from "../../Errors/index.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import type * as Trial from "../../Trial/index.js"
import type { ObjectiveEvaluator } from "../objectiveEvaluator.js"
import type { OptimizePlan, OptimizeSettings } from "../options.js"
import { evaluateObjectiveWithTimeout } from "./objectiveTimeout.js"
import type { StudyRuntime } from "./runtimeState.js"
import type { TrialContext } from "./trialContext.js"
import { aggregateObjectiveSamples } from "./trialEvaluation/aggregation.js"
import { type CacheResolveAsTrialError, ObjectiveAttempt } from "./trialEvaluation/model.js"
import { evaluateObjectiveWithRetry } from "./trialEvaluation/retry.js"

export {
  /** @since 0.1.0 */
  ObjectiveAttempt
}

type ConfigFor<Space extends SearchSpace.SearchSpace> = SearchSpace.Type<Space>

const evaluateObjectiveWithAveraging = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  trialNumber: number,
  runtime: StudyRuntime<ConfigFor<Space>>,
  running: Trial.Trial<ConfigFor<Space>>,
  trialContext: TrialContext,
  resolveCachedValue: CacheResolveAsTrialError
): Effect.Effect<ObjectiveAttempt, TrialError, ObjectiveEvaluator> =>
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
  resolveCachedValue: CacheResolveAsTrialError
): Effect.Effect<Option.Option<Exit.Exit<ObjectiveAttempt, TrialError>>, never, ObjectiveEvaluator> => {
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
    })
  )
}
