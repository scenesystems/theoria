/**
 * Result and event stream accessors for ask/tell study handles.
 *
 * @since 0.1.0
 */
import { Effect, Ref, Stream } from "effect"

import type { SearchError } from "../../../Errors/index.js"
import * as Sampler from "../../../Sampler/index.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import type * as StudyEvent from "../../../StudyEvent/index.js"
import { ExecuteOutcome } from "../../runtime.js"
import { resolveCompletionReason } from "../../runtime/completion.js"
import { readRuntimeState } from "../../runtime/runtimeState.js"
import { snapshotMetadataFromOptions } from "../../runtime/snapshotMetadata.js"
import { completedTrialsFromState, trialsFromState } from "../../state.js"
import { type StudyResult, studyResultFromOutcome } from "../result.js"
import { completeIfBudgetReached, invalid } from "./lifecycle.js"
import { stateOf, type StudyHandle } from "./model.js"

/**
 * Compute the final `StudyResult` from a completed or cancelled ask/tell handle.
 *
 * @since 0.1.0
 * @category combinators
 */
export const result = <Space extends SearchSpace.SearchSpace>(
  handle: StudyHandle<Space>
): Effect.Effect<StudyResult<SearchSpace.Type<Space>>, SearchError> =>
  Effect.gen(function*() {
    const state = stateOf(handle)
    yield* completeIfBudgetReached(state)

    const runtimeState = yield* readRuntimeState(state.runtime)
    yield* Effect.when(
      Effect.fail(invalid("Study.result requires a completed or cancelled ask/tell handle")),
      () => runtimeState.lifecycle === "Running"
    )

    const samplerCheckpoint = yield* Sampler.checkpoint(state.optimizePlan.sampler)
    const snapshotMetadata = snapshotMetadataFromOptions(state.optimizePlan, state.settings, samplerCheckpoint)
    const completionReason = resolveCompletionReason(
      yield* Ref.get(state.runtime.stopRef.ref),
      yield* Ref.get(state.runtime.completionReasonRef)
    )

    return yield* studyResultFromOutcome(
      new ExecuteOutcome({
        snapshotMetadata,
        objectiveSpec: state.settings.objectiveSpec,
        epsilon: state.settings.epsilon,
        trials: trialsFromState(runtimeState.studyState),
        completed: completedTrialsFromState(runtimeState.studyState),
        completionReason
      })
    )
  })

/**
 * Stream ask/tell lifecycle events for a manual orchestration handle.
 *
 * The stream completes automatically once the handle is cancelled or completed.
 *
 * @since 0.1.0
 * @category combinators
 */
export const events = <Space extends SearchSpace.SearchSpace>(
  handle: StudyHandle<Space>
): Stream.Stream<StudyEvent.StudyEvent> => Stream.fromQueue(stateOf(handle).eventQueue)
