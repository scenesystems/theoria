/**
 * Retry-aware optimization objective evaluation and event emission.
 *
 * @since 0.1.0
 */
import * as Journal from "@scenesystems/effect-study/Journal"
import {
  Array as Arr,
  Boolean as Bool,
  Cause,
  Effect,
  Match,
  Number as Num,
  Option,
  Ref,
  Schedule,
  Schema
} from "effect"

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
  const failures = Arr.filter(cause.reasons, Cause.isFailReason)
  const trialFailures = Arr.filter(Arr.map(failures, ({ error }) => error), isTrialError)
  return Match.value(
    Bool.and(
      Bool.not(Arr.some(cause.reasons, Cause.isDieReason)),
      Bool.and(
        Bool.not(Cause.hasInterrupts(cause)),
        Num.Equivalence(Arr.length(failures), Arr.length(trialFailures))
      )
    )
  ).pipe(
    Match.when(true, () => Arr.head(trialFailures)),
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
    const retryStep = yield* Schedule.toStepWithSleep(settings.retrySchedule)

    const evaluateUncached: Effect.Effect<ObjectiveEvaluation, TrialError | Journal.Failure> = options.objective(
      running.config,
      objectiveRuntime
    ).pipe(
      Effect.flatMap((result) => decodeObjectiveResult(trialNumber, result)),
      Effect.catchCause((cause) =>
        Effect.failCause(Cause.map(cause, (error) =>
          Option.liftPredicate(error, isJournalFailure).pipe(
            Option.match({
              onNone: () => objectiveFailure(trialNumber, error),
              onSome: (failure) => failure
            })
          )))
      ),
      Effect.provideService(CurrentTrialContext, Option.some(trialContext))
    )

    const evaluateWithCache = Effect.gen(function*() {
      const lastEvaluation = yield* Ref.make<Option.Option<ObjectiveEvaluation>>(Option.none())
      const { value } = yield* resolveCachedValue(
        new CacheRequest<
          Space["schema"]["Type"],
          Space["schema"]["Encoded"],
          TrialError | Journal.Failure,
          never
        >({
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
            ...Option.fromNullishOr(evaluation.cost).pipe(
              Option.match({
                onNone: () => ({}),
                onSome: (cost) => ({ cost })
              })
            )
          })
        ),
        Effect.catchCause((cause) =>
          Option.match(retryableTrialError(cause), {
            onNone: () => Effect.failCause(cause),
            onSome: (error) =>
              retryStep(error).pipe(
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
                    ).pipe(Effect.andThen(retryLoop(Num.increment(attempt))))
                })
              )
          })
        )
      )

    return yield* retryLoop(0)
  })
