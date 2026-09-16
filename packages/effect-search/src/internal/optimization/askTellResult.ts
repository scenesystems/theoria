/**
 * Final result and live event access for manual optimizations.
 *
 * @since 0.1.0
 */
import * as History from "@scenesystems/effect-study/History"
import type { Stream } from "effect"
import { Effect, Mailbox, Ref, String as Str } from "effect"

import * as GenericStudy from "@scenesystems/effect-study/Study"
import type { Result } from "../../Optimization.js"
import type * as OptimizationEvent from "../../OptimizationEvent.js"
import * as Sampler from "../../Sampler.js"
import type { SearchError } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
import { completeIfBudgetReached, invalid } from "./askTellLifecycle.js"
import type { HandleRuntime } from "./askTellState.js"
import { completedTrialsFromState } from "./history.js"
import { resultFromOutcome } from "./result.js"
import { ExecuteOutcome } from "./runtime.js"
import { resolveCompletionReason } from "./runtime/completion.js"
import { snapshotMetadataFromOptions } from "./runtime/snapshotMetadata.js"

/**
 * Builds the same single- or multi-objective result returned by {@link run}
 * after a manual handle has completed or been cancelled. Calling it while work
 * can still be reported fails with `InvalidOptimizationConfig`. Sampler checkpoint or
 * result construction failures remain in `SearchError`.
 *
 * @typeParam Space - Search space supplying the result trial configuration.
 *
 * @since 0.1.0
 * @category combinators
 */
export const result = <Space extends SearchSpace.SearchSpace>(
  state: HandleRuntime<Space>
): Effect.Effect<Result<SearchSpace.Type<Space>>, SearchError> =>
  Effect.gen(function*() {
    yield* completeIfBudgetReached(state)

    const runtimeState = yield* GenericStudy.read(state.runtime.study)
    yield* Effect.when(
      Effect.fail(invalid("Optimization.result requires a completed or cancelled ask/tell handle")),
      () => Str.Equivalence(runtimeState.lifecycle, "Running")
    )

    const samplerCheckpoint = yield* Sampler.checkpoint(state.optimizePlan.sampler)
    const snapshotMetadata = snapshotMetadataFromOptions(state.optimizePlan, state.settings, samplerCheckpoint)
    const completionReason = resolveCompletionReason(
      yield* Ref.get(state.runtime.stopRef),
      yield* Ref.get(state.runtime.completionReasonRef)
    )

    return yield* resultFromOutcome(
      new ExecuteOutcome({
        snapshotMetadata,
        objectiveSpec: state.settings.objectiveSpec,
        epsilon: state.settings.epsilon,
        trials: History.values(runtimeState.history),
        completed: completedTrialsFromState(runtimeState.history),
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
  state: HandleRuntime<Space>
): Stream.Stream<OptimizationEvent.OptimizationEvent> => Mailbox.toStream(state.eventQueue)
