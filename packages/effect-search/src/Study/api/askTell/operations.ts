/**
 * Scoped manual-study operations for externally evaluated configurations.
 *
 * @since 0.1.0
 */
import { Effect, Option, Predicate, PubSub, Queue, Ref } from "effect"
import type * as Scope from "effect/Scope"

import type { ObjectiveValue } from "../../../contracts/ObjectiveValue.js"
import { type SearchError, TrialError } from "../../../Errors/index.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import * as StudyEvent from "../../../StudyEvent/index.js"
import * as Trial from "../../../Trial/index.js"
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
  readStudyState,
  setRuntimeLifecycle,
  StudyClock,
  StudyClockLayer
} from "../../runtime/runtimeState.js"
import { reserveTrialOrMarkSpaceExhausted } from "../../runtime/trialReservation.js"
import { trialCountFromState } from "../../state.js"
import { completeIfBudgetReached, ensureRunning, invalid, publishCompletion } from "./lifecycle.js"
import { AskedTrial, HandleRuntime, makeStudyHandle, stateOf, type StudyHandle } from "./model.js"
import { finalizeTrial, pendingTrial, validateObjectiveValue } from "./shared.js"

/**
 * Opens a scoped study whose configurations are evaluated by caller-owned
 * workers. The supplied objective callback is retained in the normalized plan
 * but is not invoked by ask/tell operations. Invalid options, prior trials, or
 * sampler setup fail through `SearchError`.
 *
 * @remarks
 * Closing the scope shuts down the handle's event queue. Callers must finish all
 * use of the handle within that scope.
 *
 * @typeParam Space - Compiled search space that determines asked configuration values.
 *
 * @example
 * ```ts
 * import { Effect, Match } from "effect"
 * import * as Numeric from "@scenesystems/effect-math/Numeric"
 * import * as Study from "@scenesystems/effect-search/Study"
 * import * as Sampler from "@scenesystems/effect-search/Sampler"
 * import * as SearchSpace from "@scenesystems/effect-search/SearchSpace"
 *
 * export const program = Effect.scoped(
 *   Effect.gen(function*() {
 *     const space = yield* SearchSpace.make({ x: SearchSpace.float(-1, 1) })
 *     const handle = yield* Study.open({
 *       space,
 *       sampler: Sampler.random({ seed: 42 }),
 *       direction: "minimize",
 *       trials: 1,
 *       objective: () => Effect.succeed(0)
 *     })
 *
 *     const asked = yield* Study.ask(handle)
 *     yield* Study.tell(handle, asked.trialNumber, Numeric.pow(asked.config.x, 2))
 *     const result = yield* Study.result(handle)
 *
 *     return yield* Match.value(result).pipe(
 *       Match.tag("SingleObjective", (single) =>
 *         Effect.succeed(single).pipe(
 *           Effect.filterOrFail(
 *             ({ trials }) => trials.length === 1,
 *             () => "UnexpectedTrialCount"
 *           )
 *         )
 *       ),
 *       Match.tag("MultiObjective", () => Effect.fail("UnexpectedResultKind")),
 *       Match.exhaustive
 *     )
 *   })
 * )
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

    return makeStudyHandle(
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
 * Reserves the next sampled configuration and emits `TrialStarted`. The trial
 * remains pending until reported with {@link tell} or {@link fail}.
 *
 * @remarks
 * Fails through `SearchError` when the handle is closed, its trial budget is
 * exhausted, the search space has no remaining configuration, or suggestion
 * fails. Space exhaustion closes the handle before returning the error.
 *
 * @typeParam Space - Search space retained by the handle and used to infer the asked configuration.
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

    const trialNumber = trialCountFromState(yield* readStudyState(state.runtime))
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
        appendEvent(
          state.runtime,
          StudyEvent.TrialStarted({ trialNumber: running.trialNumber, config: running.config })
        ).pipe(
          Effect.as(new AskedTrial({ trialNumber: running.trialNumber, config: running.config }))
        )
    })
  })

/**
 * Completes a reserved trial with an externally computed objective value. The
 * value must be finite and must match the study's single- or multi-objective
 * arity. Completion updates incumbent events and closes the handle after the
 * configured number of trials has finished.
 *
 * @remarks
 * Fails through `SearchError` for a closed handle, an unknown or already
 * finalized trial number, or an invalid objective value.
 *
 * @typeParam Space - Search space retained by the handle receiving the objective value.
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
 * Finalizes a reserved trial with a {@link TrialError} whose `cause` retains the
 * supplied value. A string `message` property is copied when present; other
 * causes receive `"manual ask-tell failure"`.
 *
 * @remarks
 * Fails through `SearchError` for a closed handle or a trial number that is not
 * currently pending.
 *
 * @typeParam Space - Search space retained by the handle receiving the failure.
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
 * Closes a manual handle and its event stream with completion reason
 * `interrupted`. Pending trials remain in the running state in subsequent
 * snapshots or results. Repeated calls do not publish another completion event.
 *
 * @typeParam Space - Search space retained by the handle being closed.
 *
 * @since 0.1.0
 * @category combinators
 */
export const cancel = <Space extends SearchSpace.SearchSpace>(handle: StudyHandle<Space>): Effect.Effect<void> =>
  publishCompletion(stateOf(handle), "interrupted", "Cancelled")
