/**
 * Retry-aware optimization objective evaluation and event emission.
 *
 * @since 0.1.0
 */
import * as Journal from "@scenesystems/effect-study/Journal"
import { Boolean as Bool, Cause, Chunk, Effect, Match, Number as Num, Option, Ref, Schedule, Schema } from "effect"

import { Request as CacheRequest } from "../../../../ObjectiveCache.js"
import * as OptimizationEvent from "../../../../OptimizationEvent.js"
import { TrialError } from "../../../../SearchError.js"
import type * as SearchSpace from "../../../../SearchSpace.js"
import type * as Trial from "../../../../Trial.js"
import { appendEvent } from "../../events.js"
import { ObjectiveEvaluation } from "../../objectiveEvaluation.js"
import type { OptimizePlan, OptimizeSettings } from "../../options/plan.js"
import type { OptimizationRuntime } from "../bootstrap.js"
import { objectiveRuntime } from "../controls.js"
import { objectiveFailure } from "../objective.js"
import { CurrentTrialContext, type TrialContext } from "../trialContext.js"
import { decodeObjectiveResult } from "./aggregation.js"
import { type CacheResolveForTrial, ObjectiveSample } from "./outcome.js"

type ConfigFor<Space extends SearchSpace.SearchSpace> = SearchSpace.Type<Space>

const isJournalFailure = Schema.is(Journal.Failure)
const isTrialError = Schema.is(TrialError)

/**
 * The trial error an attempt may be retried for. Only a cause made of nothing but
 * trial failures qualifies: a storage failure anywhere in it is the optimization's failure,
 * a defect is a bug, and an interruption is a cancellation, and none of those is
 * undone by evaluating the objective again.
 */
const retryableTrialError = (
  cause: Cause.Cause<TrialError | Journal.Failure>
): Option.Option<TrialError> => {
  const failures = Cause.failures(cause)
  const trialFailures = Chunk.filter(failures, isTrialError)
  return Match.value(
    Bool.and(
      Chunk.isEmpty(Cause.defects(cause)),
      Bool.and(
        Bool.not(Cause.isInterrupted(cause)),
        Num.Equivalence(Chunk.size(failures), Chunk.size(trialFailures))
      )
    )
  ).pipe(
    Match.when(true, () => Chunk.head(trialFailures)),
    Match.orElse(() => Option.none())
  )
}

/**
 * Evaluates the objective function with schedule-driven retries, caching, and per-attempt event emission.
 *
 * An objective that fails because `runtime.report` or `runtime.requestStop` could not
 * persist an envelope has not failed as an objective: a cause carrying an
 * {@link Journal.Failure} passes through whole and unretried so the optimization fails
 * with it, and so does a cause carrying a defect or an interruption. When the retry
 * schedule is exhausted the last attempt's cause is the result.
 *
 * @since 0.1.0
 * @category utils
 */
export const evaluateObjectiveWithRetry = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  trialNumber: number,
  runtime: OptimizationRuntime<ConfigFor<Space>>,
  running: Trial.Trial<ConfigFor<Space>>,
  trialContext: TrialContext,
  resolveCachedValue: CacheResolveForTrial<Space["schema"]>
): Effect.Effect<ObjectiveSample, TrialError | Journal.Failure> =>
  Effect.gen(function*() {
    const retryDriver = yield* Schedule.driver(settings.retrySchedule)

    const evaluateUncached = Effect.locally(
      options.objective(running.config, objectiveRuntime).pipe(
        Effect.flatMap((result) => decodeObjectiveResult(trialNumber, result)),
        Effect.mapErrorCause(
          Cause.map((cause) =>
            Option.liftPredicate(cause, isJournalFailure).pipe(
              Option.match({
                onNone: () => objectiveFailure(trialNumber, cause),
                onSome: (storageError) => storageError
              })
            )
          )
        )
      ),
      CurrentTrialContext,
      Option.some(trialContext)
    )

    const evaluateWithCache = Effect.gen(function*() {
      const lastEvaluation = yield* Ref.make<Option.Option<ObjectiveEvaluation>>(Option.none())
      const { value } = yield* resolveCachedValue(
        new CacheRequest({
          schema: options.space.schema,
          config: running.config,
          compute: evaluateUncached.pipe(
            Effect.tap((evaluation) => Ref.set(lastEvaluation, Option.some(evaluation))),
            Effect.map((evaluation) => evaluation.value)
          )
        })
      )
      const captured = yield* Ref.get(lastEvaluation)
      return Option.getOrElse(captured, () => new ObjectiveEvaluation({ value }))
    })

    const retryLoop = (attempt: number): Effect.Effect<ObjectiveSample, TrialError | Journal.Failure> =>
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
        Effect.catchAllCause((cause) =>
          Option.match(retryableTrialError(cause), {
            onNone: () => Effect.failCause(cause),
            onSome: (error) =>
              retryDriver.next(error).pipe(
                Effect.matchEffect({
                  onFailure: () => Effect.failCause(cause),
                  onSuccess: () =>
                    appendEvent(
                      runtime,
                      OptimizationEvent.TrialRetried({
                        trialNumber,
                        attempt: Num.increment(attempt),
                        error
                      })
                    ).pipe(Effect.zipRight(retryLoop(Num.increment(attempt))))
                })
              )
          })
        )
      )

    return yield* retryLoop(0)
  })
