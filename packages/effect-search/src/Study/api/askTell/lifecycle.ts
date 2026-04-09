/**
 * Ask/tell handle lifecycle management including opening and closing study handles.
 *
 * @since 0.1.0
 */
import { Effect, Match, Option, PubSub, Ref } from "effect"

import { InvalidStudyConfig } from "../../../Errors/index.js"
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
        Match.orElse((lifecycle) =>
          Effect.fail(invalid(`Study.${operation} requires a running handle (current lifecycle: ${lifecycle})`))
        )
      )
    )
  )

/**
 * Emits a StudyCompleted event, transitions the lifecycle, and shuts down the event pubsub (idempotent).
 *
 * @since 0.1.0
 * @category utils
 */
export const publishCompletion = <Space extends SearchSpace.SearchSpace>(
  state: HandleRuntime<Space>,
  completionReason: StudyEvent.CompletionReason,
  lifecycle: "Completed" | "Cancelled"
): Effect.Effect<void> =>
  Effect.gen(function*() {
    yield* Ref.update(state.runtime.completionReasonRef, (current) =>
      Option.orElse(
        current,
        () => Option.some(completionReason)
      ))
    yield* setRuntimeLifecycle(state.runtime, lifecycle)

    const alreadyPublished = yield* Ref.get(state.completionPublishedRef)
    yield* Effect.when(
      appendEvent(state.runtime, StudyEvent.StudyCompleted.make({ completionReason })).pipe(
        Effect.zipRight(Ref.set(state.completionPublishedRef, true))
      ),
      () => !alreadyPublished
    )

    yield* PubSub.shutdown(state.pubsub)
  })

/**
 * Transitions the handle to Completed if the trial budget is exhausted and no trials are pending.
 *
 * @since 0.1.0
 * @category utils
 */
export const completeIfBudgetReached = <Space extends SearchSpace.SearchSpace>(
  state: HandleRuntime<Space>
): Effect.Effect<void> =>
  Effect.gen(function*() {
    const runtimeState = yield* readRuntimeState(state.runtime)
    const trialCount = trialCountFromState(runtimeState.studyState)
    const pendingTrials = pendingTrialsFromState(runtimeState.studyState)
    const canComplete = runtimeState.lifecycle === "Running" && trialCount >= state.settings.trials &&
      pendingTrials.length <= 0

    yield* Effect.when(publishCompletion(state, "budgetExhausted", "Completed"), () => canComplete)
  })
