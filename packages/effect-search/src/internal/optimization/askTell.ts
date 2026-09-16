/**
 * Scoped manual-optimization operations for externally evaluated configurations.
 *
 * @since 0.1.0
 */
import { Array as Arr, Clock, Effect, Mailbox, Option, Schema, SynchronizedRef } from "effect"
import type * as Scope from "effect/Scope"

import type * as Journal from "@scenesystems/effect-study/Journal"
import * as GenericStudy from "@scenesystems/effect-study/Study"
import type { Value } from "../../Objective.js"
import * as Optimization from "../../Optimization.js"
import * as OptimizationEvent from "../../OptimizationEvent.js"
import { type SearchError, TrialError } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
import * as Trial from "../../Trial.js"
import { finalizeTrial, pendingTrial, validateValue } from "./askTellFinalization.js"
import { ensureRunning, invalid, publishCompletion } from "./askTellLifecycle.js"
import { events, result } from "./askTellResult.js"
import { snapshotOptimization } from "./askTellSnapshot.js"
import { HandleRuntime } from "./askTellState.js"
import { appendEvent, EventPublisher } from "./events.js"
import { optimizePlanFromOptions } from "./options/plan/fresh.js"
import { normalizeSettings, validateSettings } from "./options/settings.js"
import { initializeRuntime } from "./runtime/bootstrap.js"
import { mergeSeedWithPriorTrials, RuntimeSeed } from "./runtime/priorSeed.js"
import { reserveNextTrialOrMarkSpaceExhausted } from "./runtime/trialReservation.js"

/**
 * Opens a scoped optimization whose configurations are evaluated by caller-owned
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
 * @since 0.1.0
 * @category combinators
 */
export const open = <Space extends SearchSpace.SearchSpace>(
  options: Optimization.Options<SearchSpace.Type<Space>, Space>
): Effect.Effect<Optimization.Optimization<Space>, SearchError, Scope.Scope> =>
  Effect.gen(function*() {
    const optimizePlan = yield* optimizePlanFromOptions(options)
    const settings = normalizeSettings(optimizePlan)
    yield* validateSettings(settings)
    const runtimeSeed = yield* mergeSeedWithPriorTrials(
      optimizePlan,
      settings.objectiveSpec,
      new RuntimeSeed({ initialTrials: Arr.empty(), startTrialNumber: 0 })
    )

    const eventQueue = yield* Mailbox.make<OptimizationEvent.OptimizationEvent>()
    yield* Effect.addFinalizer(() => eventQueue.shutdown)

    const runtime = yield* initializeRuntime(
      settings,
      runtimeSeed.initialTrials,
      new EventPublisher({ publish: (event) => eventQueue.offer(event).pipe(Effect.asVoid) })
    )

    yield* GenericStudy.transition(runtime.study, "Running")
    const completionPublishedRef = yield* SynchronizedRef.make(false)

    const state = new HandleRuntime({
      optimizePlan,
      settings,
      runtime,
      eventQueue,
      completionPublishedRef
    })
    return new Optimization.Optimization({
      ask: ask(state),
      tell: (trialNumber, value) => tell(state, trialNumber, value),
      fail: (trialNumber, cause) => fail(state, trialNumber, cause),
      cancel: cancel(state),
      events: events(state),
      result: result(state),
      snapshot: snapshotOptimization(state)
    })
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
  state: HandleRuntime<Space>
): Effect.Effect<Optimization.AskedTrial<SearchSpace.Type<Space>>, SearchError> =>
  Effect.gen(function*() {
    const reserved = yield* reserveNextTrialOrMarkSpaceExhausted(
      state.optimizePlan,
      state.settings,
      state.runtime
    )

    return yield* Option.match(reserved, {
      onNone: () =>
        publishCompletion(state, "spaceExhausted", "Completed").pipe(
          Effect.zipRight(
            Effect.fail(invalid("Optimization.ask cannot reserve a trial because the search space is exhausted"))
          )
        ),
      onSome: (running) =>
        appendEvent(
          state.runtime,
          OptimizationEvent.TrialStarted({ trialNumber: running.trialNumber, config: running.config })
        ).pipe(
          Effect.as(new Optimization.AskedTrial({ trialNumber: running.trialNumber, config: running.config }))
        )
    })
  })

/**
 * Completes a reserved trial with an externally computed objective value. The
 * value must be finite and must match the optimization's single- or multi-objective
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
  state: HandleRuntime<Space>,
  trialNumber: number,
  value: Value
): Effect.Effect<void, SearchError> =>
  Effect.gen(function*() {
    yield* ensureRunning(state.runtime, "tell")
    yield* validateValue(state.settings.objectiveSpec, trialNumber, value)
    const running = yield* pendingTrial(state, trialNumber, "tell")
    const completed = Trial.complete(running, value, yield* Clock.currentTimeMillis)

    yield* finalizeTrial(state, completed)
  })

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
  state: HandleRuntime<Space>,
  trialNumber: number,
  cause: unknown
): Effect.Effect<void, SearchError> =>
  Effect.gen(function*() {
    yield* ensureRunning(state.runtime, "fail")
    const running = yield* pendingTrial(state, trialNumber, "fail")
    const message = Schema.decodeUnknownOption(Schema.Struct({ message: Schema.String }))(cause).pipe(
      Option.map(({ message }) => message),
      Option.getOrElse(() => "manual ask-tell failure")
    )
    const failed = Trial.fail(running, new TrialError({ trialNumber, message, cause }), yield* Clock.currentTimeMillis)

    yield* finalizeTrial(state, failed)
  })

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
export const cancel = <Space extends SearchSpace.SearchSpace>(
  state: HandleRuntime<Space>
): Effect.Effect<void, Journal.Failure> => publishCompletion(state, "interrupted", "Cancelled")
