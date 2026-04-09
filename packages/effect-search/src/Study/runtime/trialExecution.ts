/**
 * Full trial execution pipeline from reservation through evaluation to state transition.
 *
 * @since 0.1.0
 */
import { Effect, Match, Option, Ref, Tuple } from "effect"

import * as Errors from "../../Errors/index.js"
import type { SearchError } from "../../Errors/index.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import * as StudyEvent from "../../StudyEvent/index.js"
import { Trial } from "../../Trial/index.js"
import { appendEvent, emitLifecycleEvents } from "../events.js"
import type { ObjectiveEvaluator } from "../objectiveEvaluator.js"
import type { OptimizePlan, OptimizeSettings } from "../options.js"
import { trialToSnapshot } from "../snapshot/stateCodec.js"
import { withFinalizedTrial, withReservedTrial } from "../state.js"
import * as StudyObjectiveCache from "../studyObjectiveCache.js"
import { appendTrialIfAvailable } from "../studyStorage.js"
import { emitTrialCostedAndMarkBudget, shouldSkipByMaxCost } from "./budget.js"
import { shouldSkipNextTrial } from "./completion.js"
import { ReportRefs } from "./controls.js"
import { finalizeTrialWithPrune } from "./objective.js"
import {
  objectiveCost,
  objectiveEvaluationCount,
  objectiveExitValue,
  objectiveRetryCount,
  objectiveVariance
} from "./objectiveResult.js"
import type { PruningPolicy } from "./pruning.js"
import { RuntimeState } from "./runtimeState.js"
import { modifyRuntimeState, StudyClock, type StudyRuntime } from "./runtimeState.js"
import { applyTrialStoppingPolicies } from "./stopping.js"
import { TrialContext } from "./trialContext.js"
import { evaluateObjectiveWithPolicy } from "./trialEvaluation.js"
import type { CacheResolveAsTrialError } from "./trialEvaluation/model.js"
import { reserveTrialOrMarkSpaceExhausted } from "./trialReservation.js"

type ConfigFor<Space extends SearchSpace.SearchSpace> = SearchSpace.Type<Space>

const trialErrorFromCacheError = (
  trialNumber: number,
  error: StudyObjectiveCache.StudyObjectiveCacheError
) =>
  new Errors.TrialError({
    trialNumber,
    message: `objective cache failure: ${error._tag}`,
    cause: error
  })

const recordFinalizedTrial = <Config>(
  runtime: StudyRuntime<Config>,
  finalized: Trial<Config>
): Effect.Effect<void> =>
  modifyRuntimeState(runtime, (state) =>
    Effect.succeed(
      Tuple.make(
        undefined,
        new RuntimeState({
          lifecycle: state.lifecycle,
          studyState: withFinalizedTrial(state.studyState, finalized),
          suggestionState: state.suggestionState.withFinalizedTrial(finalized)
        })
      )
    ))

const executeReservedTrial = Effect.fn("effect-search/Study.executeReservedTrial")(
  <Space extends SearchSpace.SearchSpace>(
    options: OptimizePlan<ConfigFor<Space>, Space>,
    settings: OptimizeSettings,
    pruningPolicy: PruningPolicy,
    trialNumber: number,
    runtime: StudyRuntime<ConfigFor<Space>>,
    running: Trial<ConfigFor<Space>>,
    resource: Option.Option<number>
  ): Effect.Effect<Trial<ConfigFor<Space>>, SearchError, StudyClock | ObjectiveEvaluator> =>
    Effect.gen(function*() {
      const clock = yield* StudyClock
      const reportRefs = yield* ReportRefs.allocate
      const trialContext = new TrialContext({
        trialNumber,
        studyRuntime: runtime,
        stopRef: runtime.stopRef,
        reportRefs,
        stopMode: settings.stopMode,
        pruningPolicy,
        resource
      })
      const objectiveCache = yield* Effect.serviceOption(StudyObjectiveCache.StudyObjectiveCache)
      const resolveCachedValue: CacheResolveAsTrialError = Option.match(objectiveCache, {
        onNone: () => ({ compute }) =>
          compute.pipe(
            Effect.map((value) => Tuple.make(value, "miss"))
          ),
        onSome: (cache) => ({ config, compute }) =>
          cache.resolve({ config, compute }).pipe(
            Effect.catchTags({
              "effect-search/CacheCorrupt": (error) => Effect.fail(trialErrorFromCacheError(trialNumber, error)),
              "effect-search/CacheBackendError": (error) => Effect.fail(trialErrorFromCacheError(trialNumber, error))
            })
          )
      })

      const runtimeState = yield* runtime.stateActor.get
      const event = Option.match(runtimeState.suggestionState.lastSuggestionDiagnostics, {
        onNone: () => StudyEvent.TrialStarted.make({ trialNumber, config: running.config }),
        onSome: (diagnostics) => StudyEvent.TrialStarted.make({ trialNumber, config: running.config, diagnostics })
      })

      yield* appendEvent(runtime, event)

      const objectiveExitOption = yield* evaluateObjectiveWithPolicy(
        options,
        settings,
        trialNumber,
        runtime,
        running,
        trialContext,
        resolveCachedValue
      )

      const finishedAt = yield* clock.now

      return yield* Option.match(objectiveExitOption, {
        onNone: () =>
          Effect.gen(function*() {
            const cancelled = Trial.cancel(running)
            yield* recordFinalizedTrial(runtime, cancelled)
            yield* appendTrialIfAvailable(trialToSnapshot(cancelled))
            yield* appendEvent(runtime, StudyEvent.TrialCancelled.make({ trialNumber, reason: "timeout" }))
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
            yield* appendTrialIfAvailable(trialToSnapshot(finalized))
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
): Effect.Effect<Trial<ConfigFor<Space>>, never, StudyClock> =>
  modifyRuntimeState(runtime, (state) =>
    Effect.gen(function*() {
      const clock = yield* StudyClock
      const startedAt = yield* clock.now
      const running = Trial.run(trialNumber, config, startedAt)

      return Tuple.make(
        running,
        new RuntimeState({
          lifecycle: state.lifecycle,
          studyState: withReservedTrial(state.studyState, running),
          suggestionState: state.suggestionState.withReservedTrial(running)
        })
      )
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
  pruningPolicy: PruningPolicy,
  trialNumber: number,
  runtime: StudyRuntime<ConfigFor<Space>>
): Effect.Effect<void, SearchError, StudyClock | ObjectiveEvaluator> =>
  Effect.gen(function*() {
    const skipNextTrial = yield* shouldSkipNextTrial(runtime.stopRef, runtime.completionReasonRef)
    const skipByCost = yield* shouldSkipByMaxCost(settings, runtime)
    const skipTrial = skipNextTrial || skipByCost

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
      () => !skipTrial
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
  pruningPolicy: PruningPolicy,
  trialNumber: number,
  config: ConfigFor<Space>,
  runtime: StudyRuntime<ConfigFor<Space>>,
  resource: Option.Option<number>
): Effect.Effect<Option.Option<Trial<ConfigFor<Space>>>, SearchError, StudyClock | ObjectiveEvaluator> =>
  Effect.gen(function*() {
    const skipNextTrial = yield* shouldSkipNextTrial(runtime.stopRef, runtime.completionReasonRef)
    const skipByCost = yield* shouldSkipByMaxCost(settings, runtime)
    const skipTrial = skipNextTrial || skipByCost

    return yield* Match.value(skipTrial).pipe(
      Match.when(true, () => Effect.succeed(Option.none())),
      Match.orElse(() =>
        reserveConfiguredTrial(config, trialNumber, runtime).pipe(
          Effect.flatMap((running) =>
            executeReservedTrial(options, settings, pruningPolicy, trialNumber, runtime, running, resource)
          ),
          Effect.map(Option.some)
        )
      )
    )
  })
