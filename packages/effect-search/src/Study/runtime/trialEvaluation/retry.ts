/**
 * Retry-aware objective evaluation with schedule-driven repetition and event emission.
 *
 * @since 0.1.0
 */
import { Effect, Number as Num, Option, Ref, Schedule } from "effect"

import type { TrialError } from "../../../Errors/index.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import * as StudyEvent from "../../../StudyEvent/index.js"
import type * as Trial from "../../../Trial/index.js"
import { appendEvent } from "../../events.js"
import { ObjectiveEvaluation, ObjectiveEvaluator } from "../../objectiveEvaluator.js"
import type { OptimizePlan, OptimizeSettings } from "../../options.js"
import { objectiveRuntime } from "../controls.js"
import { objectiveFailure } from "../objective.js"
import type { StudyRuntime } from "../runtimeState.js"
import { CurrentTrialContext, type TrialContext } from "../trialContext.js"
import { decodeObjectiveResult } from "./aggregation.js"
import { type CacheResolveAsTrialError, ObjectiveSample } from "./model.js"

type ConfigFor<Space extends SearchSpace.SearchSpace> = SearchSpace.Type<Space>

/**
 * Evaluates the objective function with schedule-driven retries, caching, and per-attempt event emission.
 *
 * @since 0.1.0
 * @category utils
 */
export const evaluateObjectiveWithRetry = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  trialNumber: number,
  runtime: StudyRuntime<ConfigFor<Space>>,
  running: Trial.Trial<ConfigFor<Space>>,
  trialContext: TrialContext,
  resolveCachedValue: CacheResolveAsTrialError
): Effect.Effect<ObjectiveSample, TrialError, ObjectiveEvaluator> =>
  Effect.gen(function*() {
    const objectiveEvaluator = yield* ObjectiveEvaluator
    const retryDriver = yield* Schedule.driver(settings.retrySchedule)

    const evaluateUncached = Effect.locally(
      objectiveEvaluator.evaluate(
        options.objective,
        running.config,
        objectiveRuntime
      ).pipe(
        Effect.flatMap((result) => decodeObjectiveResult(trialNumber, result)),
        Effect.mapError((cause) => objectiveFailure(trialNumber, cause))
      ),
      CurrentTrialContext,
      Option.some(trialContext)
    )

    const evaluateWithCache = Effect.gen(function*() {
      const lastEvaluation = yield* Ref.make<Option.Option<ObjectiveEvaluation>>(Option.none())
      const [value] = yield* resolveCachedValue({
        config: running.config,
        compute: evaluateUncached.pipe(
          Effect.tap((evaluation) => Ref.set(lastEvaluation, Option.some(evaluation))),
          Effect.map((evaluation) => evaluation.value)
        )
      })
      const captured = yield* Ref.get(lastEvaluation)
      return Option.getOrElse(captured, () => new ObjectiveEvaluation({ value }))
    })

    const retryLoop = (attempt: number): Effect.Effect<ObjectiveSample, TrialError> =>
      evaluateWithCache.pipe(
        Effect.map((evaluation) =>
          new ObjectiveSample({
            value: evaluation.value,
            retryCount: attempt,
            ...Option.fromNullable(evaluation.cost).pipe(
              Option.match({
                onNone: () => ({}),
                onSome: (cost) => ({ cost })
              })
            )
          })
        ),
        Effect.catchAll((error) =>
          retryDriver.next(error).pipe(
            Effect.matchEffect({
              onFailure: () => Effect.fail(error),
              onSuccess: () =>
                appendEvent(
                  runtime,
                  StudyEvent.TrialRetried({
                    trialNumber,
                    attempt: Num.increment(attempt),
                    error
                  })
                ).pipe(Effect.zipRight(retryLoop(Num.increment(attempt))))
            })
          )
        )
      )

    return yield* retryLoop(0)
  })
