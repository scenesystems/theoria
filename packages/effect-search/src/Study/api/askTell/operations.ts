/**
 * Core ask/tell operations: ask for trial suggestions, tell results, cancel, and fail.
 *
 * @since 0.1.0
 */
import { Effect, Option, Predicate, PubSub, Queue, Ref } from "effect"
import type * as Scope from "effect/Scope"

import type { ObjectiveValue } from "../../../contracts/ObjectiveValue.js"
import { type SearchError, TrialError } from "../../../Errors/index.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import * as StudyEvent from "../../../StudyEvent/index.js"
import { Trial } from "../../../Trial/index.js"
import { appendEvent, eventPublisherFromPubSub } from "../../events.js"
import {
  normalizeSettings,
  type OptimizeOptionsFromSpace,
  optimizePlanFromOptions,
  validateSettings
} from "../../options.js"
import { mergeSeedWithPriorTrials, RuntimeSeed } from "../../runtime/priorSeed.js"
import {
  initializeRuntime,
  readRuntimeState,
  setRuntimeLifecycle,
  StudyClock,
  StudyClockLayer
} from "../../runtime/runtimeState.js"
import { reserveTrialOrMarkSpaceExhausted } from "../../runtime/trialReservation.js"
import { completeIfBudgetReached, ensureRunning, invalid, publishCompletion } from "./lifecycle.js"
import { AskedTrial, HandleRuntime, stateOf, StudyHandle } from "./model.js"
import { finalizeTrial, pendingTrial, validateObjectiveValue } from "./shared.js"

/**
 * Open a manual ask/tell study handle.
 *
 * Use this when trial evaluation happens outside `Study.optimize`, such as
 * distributed workers, human-in-the-loop review, or integration with external executors.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as Study from "effect-search/Study"
 * import * as Sampler from "effect-search/Sampler"
 * import * as SearchSpace from "effect-search/SearchSpace"
 *
 * const space = SearchSpace.unsafeMake({ lr: SearchSpace.float(0, 1) })
 *
 * Effect.gen(function*() {
 *   const handle = yield* Study.open({
 *     space,
 *     sampler: Sampler.random({ seed: 42 }),
 *     direction: "minimize",
 *     trials: 5,
 *     objective: () => Effect.succeed(0)
 *   })
 *   const asked = yield* Study.ask(handle)
 *   yield* Study.tell(handle, asked.trialNumber, 0.12)
 * })
 * ```
 *
 * @since 0.1.0
 * @category combinators
 */
export const open = <Space extends SearchSpace.SearchSpace>(
  options: OptimizeOptionsFromSpace<Space>
): Effect.Effect<StudyHandle<Space>, SearchError, Scope.Scope> =>
  Effect.gen(function*() {
    const optimizePlan = yield* optimizePlanFromOptions(options)
    const settings = normalizeSettings(optimizePlan)
    yield* validateSettings(settings)
    const runtimeSeed = yield* mergeSeedWithPriorTrials(
      optimizePlan,
      settings.objectiveSpec,
      new RuntimeSeed({ initialTrials: [], startTrialNumber: 0 })
    )

    const pubsub = yield* PubSub.unbounded<StudyEvent.StudyEvent>()
    const eventQueue = yield* PubSub.subscribe(pubsub)
    yield* Effect.addFinalizer(() => PubSub.shutdown(pubsub))
    yield* Effect.addFinalizer(() => Queue.shutdown(eventQueue))

    const runtime = yield* initializeRuntime(
      settings,
      runtimeSeed.initialTrials,
      eventPublisherFromPubSub(pubsub)
    ).pipe(Effect.provide(StudyClockLayer))

    yield* setRuntimeLifecycle(runtime, "Running")
    const completionPublishedRef = yield* Ref.make(false)

    return StudyHandle.make(
      new HandleRuntime({
        optimizePlan,
        settings,
        runtime,
        pubsub,
        eventQueue,
        completionPublishedRef
      })
    )
  })

/**
 * Reserve the next trial configuration from a manual ask/tell handle.
 *
 * @since 0.1.0
 * @category combinators
 */
export const ask = <Space extends SearchSpace.SearchSpace>(
  handle: StudyHandle<Space>
): Effect.Effect<AskedTrial<SearchSpace.Type<Space>>, SearchError> =>
  Effect.gen(function*() {
    const state = stateOf(handle)
    yield* ensureRunning(state.runtime, "ask")
    yield* completeIfBudgetReached(state)

    const trialNumber = (yield* readRuntimeState(state.runtime)).suggestionState.nextTrialNumber
    yield* Effect.when(
      Effect.fail(invalid("Study.ask cannot reserve a trial because the configured trial budget is exhausted")),
      () => trialNumber >= state.settings.trials
    )

    const reserved = yield* reserveTrialOrMarkSpaceExhausted(
      state.optimizePlan,
      state.settings,
      trialNumber,
      state.runtime
    ).pipe(Effect.provide(StudyClockLayer))

    return yield* Option.match(reserved, {
      onNone: () =>
        publishCompletion(state, "spaceExhausted", "Completed").pipe(
          Effect.zipRight(
            Effect.fail(invalid("Study.ask cannot reserve a trial because the search space is exhausted"))
          )
        ),
      onSome: (running) =>
        Effect.gen(function*() {
          const reservedState = yield* readRuntimeState(state.runtime)
          const event = Option.match(reservedState.suggestionState.lastSuggestionDiagnostics, {
            onNone: () => StudyEvent.TrialStarted({ trialNumber: running.trialNumber, config: running.config }),
            onSome: (diagnostics) =>
              StudyEvent.TrialStarted({ trialNumber: running.trialNumber, config: running.config, diagnostics })
          })

          yield* appendEvent(state.runtime, event)

          return new AskedTrial({ trialNumber: running.trialNumber, config: running.config })
        })
    })
  })

/**
 * Record a completed objective value for a reserved trial.
 *
 * @since 0.1.0
 * @category combinators
 */
export const tell = <Space extends SearchSpace.SearchSpace>(
  handle: StudyHandle<Space>,
  trialNumber: number,
  value: ObjectiveValue
): Effect.Effect<void, SearchError> =>
  Effect.gen(function*() {
    const state = stateOf(handle)
    yield* ensureRunning(state.runtime, "tell")
    yield* validateObjectiveValue(state.settings.objectiveSpec, trialNumber, value)
    const running = yield* pendingTrial(state, trialNumber, "tell")
    const clock = yield* StudyClock
    const completed = Trial.complete(running, value, yield* clock.now)

    yield* finalizeTrial(handle, completed)
  }).pipe(Effect.provide(StudyClockLayer))

/**
 * Mark a reserved trial as failed with a typed trial error.
 *
 * @since 0.1.0
 * @category combinators
 */
export const fail = <Space extends SearchSpace.SearchSpace>(
  handle: StudyHandle<Space>,
  trialNumber: number,
  cause: unknown
): Effect.Effect<void, SearchError> =>
  Effect.gen(function*() {
    const state = stateOf(handle)
    yield* ensureRunning(state.runtime, "fail")
    const running = yield* pendingTrial(state, trialNumber, "fail")
    const clock = yield* StudyClock
    const maybeMessage = Reflect.get(Predicate.isRecord(cause) ? cause : {}, "message")
    const message = typeof maybeMessage === "string" ? maybeMessage : "manual ask-tell failure"
    const failed = Trial.fail(running, new TrialError({ trialNumber, message, cause }), yield* clock.now)

    yield* finalizeTrial(handle, failed)
  }).pipe(Effect.provide(StudyClockLayer))

/**
 * Cancel a manual ask/tell handle and complete its event stream.
 *
 * @since 0.1.0
 * @category combinators
 */
export const cancel = <Space extends SearchSpace.SearchSpace>(handle: StudyHandle<Space>): Effect.Effect<void> =>
  publishCompletion(stateOf(handle), "interrupted", "Cancelled")
