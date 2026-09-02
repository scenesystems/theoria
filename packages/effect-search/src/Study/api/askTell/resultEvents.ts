/**
 * Final result and live event access for manual studies.
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
 * Builds the same single- or multi-objective result returned by {@link optimize}
 * after a manual handle has completed or been cancelled. Calling it while work
 * can still be reported fails with `InvalidStudyConfig`. Sampler checkpoint or
 * result construction failures remain in `SearchError`.
 *
 * @typeParam Space - Search space supplying the result trial configuration.
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
 * Consumes events emitted after the handle opened and completes when the handle
 * is cancelled, exhausts its budget, or exhausts the search space. Events are
 * not replayed. Calls share one queue, so concurrent consumers divide events
 * between them instead of each receiving a copy.
 *
 * @typeParam Space - Search space retained by the event source handle.
 *
 * @since 0.1.0
 * @category combinators
 */
export const events = <Space extends SearchSpace.SearchSpace>(
  handle: StudyHandle<Space>
): Stream.Stream<StudyEvent.StudyEvent> => Stream.fromQueue(stateOf(handle).eventQueue)
