/**
 * Full trial execution pipeline from reservation through evaluation to state transition.
 *
 * @since 0.1.0
 */
import * as History from "@scenesystems/effect-study/History"
import { Boolean as Bool, Clock, Effect, Match, Option, Ref, String as Str, Tuple } from "effect"

import * as Cache from "../../../Cache.js"
import * as ObjectiveCache from "../../../ObjectiveCache.js"
import type { Policy } from "../../../Pruning.js"
import * as Errors from "../../../SearchError.js"
import type { SearchError } from "../../../SearchError.js"
import type * as SearchSpace from "../../../SearchSpace.js"
import * as StudyEvent from "../../../StudyEvent.js"
import * as StudySnapshot from "../../../StudySnapshot.js"
import * as StudyStorage from "../../../StudyStorage.js"
import * as Trial from "../../../Trial.js"
import { appendEvent, emitLifecycleEvents } from "../events.js"
import type { OptimizePlan, OptimizeSettings } from "../options/plan.js"
import { emitTrialCostedAndMarkBudget, shouldSkipByMaxCost } from "./budget.js"
import { shouldSkipNextTrial } from "./completion.js"
import { makeReportRefs } from "./controls.js"
import { finalizeTrialWithPrune } from "./objective.js"
import {
  objectiveCost,
  objectiveEvaluationCount,
  objectiveExitValue,
  objectiveRetryCount,
  objectiveVariance
} from "./objectiveResult.js"
import { modifyStudyState, type StudyRuntime } from "./runtimeState.js"
import { applyTrialStoppingPolicies } from "./stopping.js"
import { TrialContext } from "./trialContext.js"
import { evaluateObjectiveWithPolicy } from "./trialEvaluation.js"
import type { CacheResolveForTrial } from "./trialEvaluation/outcome.js"
import { reserveTrialOrMarkSpaceExhausted } from "./trialReservation.js"

type ConfigFor<Space extends SearchSpace.SearchSpace> = SearchSpace.Type<Space>

const trialErrorFromCacheError = (
  trialNumber: number,
  error: ObjectiveCache.Error
) =>
  new Errors.TrialError({
    trialNumber,
    message: Str.concat("objective cache failure: ", error._tag),
    cause: error
  })

const recordFinalizedTrial = <Config>(
  runtime: StudyRuntime<Config>,
  finalized: Trial.Trial<Config>
): Effect.Effect<void> =>
  modifyStudyState(runtime, (state) => Effect.succeed(Tuple.make(undefined, History.set(state, finalized))))

const executeReservedTrial = Effect.fn("effect-search/Study.executeReservedTrial")(
  <Space extends SearchSpace.SearchSpace>(
    options: OptimizePlan<ConfigFor<Space>, Space>,
    settings: OptimizeSettings,
    pruningPolicy: Policy,
    trialNumber: number,
    runtime: StudyRuntime<ConfigFor<Space>>,
    running: Trial.Trial<ConfigFor<Space>>,
    resource: Option.Option<number>
  ): Effect.Effect<Trial.Trial<ConfigFor<Space>>, SearchError> =>
    Effect.gen(function*() {
      const reportRefs = yield* makeReportRefs
      const trialContext = new TrialContext({
        trialNumber,
        studyRuntime: runtime,
        stopRef: runtime.stopRef,
        reportRefs,
        stopMode: settings.stopMode,
        pruningPolicy,
        resource
      })
      const objectiveCache = yield* Effect.serviceOption(ObjectiveCache.ObjectiveCache)
      const resolveCachedValue: CacheResolveForTrial<Space["schema"]> = Option.match(objectiveCache, {
        onNone: () => (request) =>
          request.compute.pipe(
            Effect.map((value) => new Cache.Result({ value, resolution: "miss" }))
          ),
        onSome: (cache) => (request) =>
          cache.resolve(request).pipe(
            Effect.catchTags({
              "effect-search/CacheCorrupt": (error) => Effect.fail(trialErrorFromCacheError(trialNumber, error)),
              "effect-search/CacheBackendError": (error) => Effect.fail(trialErrorFromCacheError(trialNumber, error))
            })
          )
      })

      yield* appendEvent(runtime, StudyEvent.trialStarted({ trialNumber, config: running.config }))

      const objectiveExitOption = yield* evaluateObjectiveWithPolicy(
        options,
        settings,
        trialNumber,
        runtime,
        running,
        trialContext,
        resolveCachedValue
      )

      const finishedAt = yield* Clock.currentTimeMillis

      return yield* Option.match(objectiveExitOption, {
        onNone: () =>
          Effect.gen(function*() {
            const cancelled = Trial.cancel(running)
            yield* recordFinalizedTrial(runtime, cancelled)
            yield* StudyStorage.appendIfAvailable(StudySnapshot.fromTrial(cancelled))
            yield* appendEvent(runtime, StudyEvent.trialCancelled({ trialNumber, reason: "timeout" }))
            return cancelled
          }),
        onSome: (objectiveExit) =>
          Effect.gen(function*() {
            const retryCount = objectiveRetryCount(objectiveExit)
            const finalized = yield* finalizeTrialWithPrune(
              running,
              settings.objectiveSpec,
              trialNumber,
              finishedAt,
              objectiveExitValue(objectiveExit),
              yield* Ref.get(reportRefs.pruneRef),
              retryCount,
              objectiveCost(objectiveExit),
              objectiveEvaluationCount(objectiveExit),
              objectiveVariance(objectiveExit)
            )

            yield* recordFinalizedTrial(runtime, finalized)
            yield* StudyStorage.appendIfAvailable(StudySnapshot.fromTrial(finalized))
            yield* emitLifecycleEvents(settings.objectiveSpec, finalized, runtime)
            yield* emitTrialCostedAndMarkBudget(settings, runtime, finalized)
            yield* applyTrialStoppingPolicies(settings, runtime, finalized)
            return finalized
          })
      })
    })
)

const reserveConfiguredTrial = <Space extends SearchSpace.SearchSpace>(
  config: ConfigFor<Space>,
  trialNumber: number,
  runtime: StudyRuntime<ConfigFor<Space>>
): Effect.Effect<Trial.Trial<ConfigFor<Space>>> =>
  modifyStudyState(runtime, (state) =>
    Effect.gen(function*() {
      const startedAt = yield* Clock.currentTimeMillis
      const running = Trial.makeRunning(trialNumber, config, startedAt)

      return Tuple.make(running, History.set(state, running))
    }))

/**
 * Executes a single scheduled trial: reserves, evaluates, finalizes, and applies stopping policies.
 *
 * @since 0.1.0
 * @category utils
 */
export const runScheduledTrial = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  pruningPolicy: Policy,
  trialNumber: number,
  runtime: StudyRuntime<ConfigFor<Space>>
): Effect.Effect<void, SearchError> =>
  Effect.gen(function*() {
    const skipNextTrial = yield* shouldSkipNextTrial(runtime.stopRef, runtime.completionReasonRef)
    const skipByCost = yield* shouldSkipByMaxCost(settings, runtime)
    const skipTrial = Bool.or(skipNextTrial, skipByCost)

    yield* Effect.when(
      Effect.gen(function*() {
        const runningOption = yield* reserveTrialOrMarkSpaceExhausted(options, settings, trialNumber, runtime)
        yield* Option.match(runningOption, {
          onNone: () => Effect.void,
          onSome: (running) =>
            executeReservedTrial(
              options,
              settings,
              pruningPolicy,
              trialNumber,
              runtime,
              running,
              Option.none()
            ).pipe(Effect.asVoid)
        })
      }),
      () => Bool.not(skipTrial)
    )
  })

/**
 * Executes a trial with a pre-determined configuration and fidelity resource, returning None if the trial was skipped.
 *
 * @since 0.1.0
 * @category utils
 */
export const runConfiguredTrial = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  pruningPolicy: Policy,
  trialNumber: number,
  config: ConfigFor<Space>,
  runtime: StudyRuntime<ConfigFor<Space>>,
  resource: Option.Option<number>
): Effect.Effect<Option.Option<Trial.Trial<ConfigFor<Space>>>, SearchError> =>
  Effect.gen(function*() {
    const skipNextTrial = yield* shouldSkipNextTrial(runtime.stopRef, runtime.completionReasonRef)
    const skipByCost = yield* shouldSkipByMaxCost(settings, runtime)
    const skipTrial = Bool.or(skipNextTrial, skipByCost)

    return yield* Match.value(skipTrial).pipe(
      Match.when(true, () => Effect.succeedNone),
      Match.orElse(() =>
        reserveConfiguredTrial(config, trialNumber, runtime).pipe(
          Effect.flatMap((running) =>
            executeReservedTrial(options, settings, pruningPolicy, trialNumber, runtime, running, resource)
          ),
          Effect.asSome
        )
      )
    )
  })
