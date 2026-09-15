/**
 * Ask/tell handle lifecycle management including opening and closing study handles.
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

import { type ArtifactStorageError, InvalidStudyConfig } from "../../../Errors/index.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import * as StudyEvent from "../../../StudyEvent/index.js"
import { appendEvent } from "../../events.js"
import { readRuntimeState, setRuntimeLifecycle, type StudyRuntime } from "../../runtime/runtimeState.js"
import { pendingTrialsFromState, trialCountFromState } from "../../state.js"
import type { HandleRuntime } from "./model.js"

/**
 * Constructs an InvalidStudyConfig error for ask/tell handle validation failures.
 *
 * @since 0.1.0
 * @category constructors
 */
export const invalid = (reason: string): InvalidStudyConfig => new InvalidStudyConfig({ reason })

/**
 * Fails with InvalidStudyConfig if the study handle is not in the Running lifecycle state.
 *
 * @since 0.1.0
 * @category guards
 */
export const ensureRunning = <Config>(
  runtime: StudyRuntime<Config>,
  operation: string
): Effect.Effect<void, InvalidStudyConfig> =>
  readRuntimeState(runtime).pipe(
    Effect.flatMap((runtimeState) =>
      Match.value(runtimeState.lifecycle).pipe(
        Match.when("Running", () => Effect.void),
        Match.whenOr("Created", "Paused", "Completed", "Failed", "Cancelled", (lifecycle) =>
          Effect.fail(
            invalid(
              Arr.join(
                Arr.make("Study.", operation, " requires a running handle (current lifecycle: ", lifecycle, ")"),
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
  completionReason: StudyEvent.CompletionReason,
  lifecycle: Schema.Schema.Type<Schema.Literal<["Completed", "Cancelled"]>>
): Effect.Effect<void, ArtifactStorageError> =>
  Effect.gen(function*() {
    yield* Ref.update(state.runtime.completionReasonRef, (current) =>
      Option.orElse(
        current,
        () => Option.some(completionReason)
      ))
    yield* setRuntimeLifecycle(state.runtime, lifecycle)

    yield* SynchronizedRef.updateEffect(state.completionPublishedRef, (published) =>
      Effect.if(published, {
        onTrue: () => Effect.succeed(true),
        onFalse: () => appendEvent(state.runtime, StudyEvent.StudyCompleted({ completionReason })).pipe(Effect.as(true))
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
): Effect.Effect<void, ArtifactStorageError> =>
  Effect.gen(function*() {
    const runtimeState = yield* readRuntimeState(state.runtime)
    const trialCount = trialCountFromState(runtimeState.studyState)
    const pendingTrials = pendingTrialsFromState(runtimeState.studyState)
    const canComplete = Bool.every(Arr.make(
      Str.Equivalence(runtimeState.lifecycle, "Running"),
      Num.greaterThanOrEqualTo(trialCount, state.settings.trials),
      Arr.isEmptyArray(pendingTrials)
    ))

    yield* Effect.when(publishCompletion(state, "budgetExhausted", "Completed"), () => canComplete)
  })
