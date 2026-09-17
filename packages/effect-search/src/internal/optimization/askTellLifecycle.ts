/**
 * Ask/tell handle lifecycle management including opening and closing optimization handles.
 *
 * @since 0.1.0
 */
import type { Schema } from "effect"
import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Match,
  Number as Num,
  Option,
  Ref,
  String as Str,
  SynchronizedRef
} from "effect"

import type * as Journal from "@scenesystems/effect-study/Journal"
import * as GenericStudy from "@scenesystems/effect-study/Study"
import * as OptimizationEvent from "../../OptimizationEvent.js"
import { InvalidOptimizationConfig } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
import type { HandleRuntime } from "./askTellState.js"
import { appendEvent } from "./events.js"
import { pendingTrialsFromState, trialCountFromState } from "./history.js"
import type { OptimizationRuntime } from "./runtime/bootstrap.js"

/**
 * Constructs an InvalidOptimizationConfig error for ask/tell handle validation failures.
 *
 * @since 0.1.0
 * @category constructors
 */
export const invalid = (reason: string): InvalidOptimizationConfig => new InvalidOptimizationConfig({ reason })

/**
 * Fails with InvalidOptimizationConfig if the optimization handle is not Running.
 *
 * @since 0.1.0
 * @category guards
 */
export const ensureRunning = <Config>(
  runtime: OptimizationRuntime<Config>,
  operation: string
): Effect.Effect<void, InvalidOptimizationConfig> =>
  GenericStudy.read(runtime.study).pipe(
    Effect.flatMap((runtimeState) =>
      Match.value(runtimeState.lifecycle).pipe(
        Match.when("Running", () => Effect.void),
        Match.whenOr("Created", "Paused", "Completed", "Failed", "Cancelled", (lifecycle) =>
          Effect.fail(
            invalid(
              Arr.join(
                Arr.make("Optimization.", operation, " requires a running handle (current lifecycle: ", lifecycle, ")"),
                ""
              )
            )
          )),
        Match.exhaustive
      )
    )
  )

/**
 * Emits completion once, transitions the lifecycle, and drains the event mailbox before ending.
 *
 * @since 0.1.0
 * @category utils
 */
export const publishCompletion = <Space extends SearchSpace.SearchSpace>(
  state: HandleRuntime<Space>,
  completionReason: OptimizationEvent.CompletionReason,
  lifecycle: Schema.Schema.Type<Schema.Literal<["Completed", "Cancelled"]>>
): Effect.Effect<void, Journal.Failure> =>
  Effect.gen(function*() {
    yield* Ref.update(state.runtime.completionReasonRef, (current) =>
      Option.orElse(
        current,
        () => Option.some(completionReason)
      ))
    yield* GenericStudy.transition(state.runtime.study, lifecycle)

    yield* SynchronizedRef.updateEffect(state.completionPublishedRef, (published) =>
      Effect.if(published, {
        onTrue: () => Effect.succeed(true),
        onFalse: () =>
          appendEvent(state.runtime, OptimizationEvent.Completed({ completionReason })).pipe(Effect.as(true))
      }))
    yield* state.eventQueue.end
  })

/**
 * Transitions the handle to Completed if the trial budget is exhausted and no trials are pending.
 *
 * @since 0.1.0
 * @category utils
 */
export const completeIfBudgetReached = <Space extends SearchSpace.SearchSpace>(
  state: HandleRuntime<Space>
): Effect.Effect<void, Journal.Failure> =>
  Effect.gen(function*() {
    const runtimeState = yield* GenericStudy.read(state.runtime.study)
    const trialCount = trialCountFromState(runtimeState.history)
    const pendingTrials = pendingTrialsFromState(runtimeState.history)
    const canComplete = Bool.every(Arr.make(
      Str.Equivalence(runtimeState.lifecycle, "Running"),
      Num.greaterThanOrEqualTo(trialCount, state.settings.trials),
      Arr.isEmptyArray(pendingTrials)
    ))

    yield* Effect.when(publishCompletion(state, "budgetExhausted", "Completed"), () => canComplete)
  })
