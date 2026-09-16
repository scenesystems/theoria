/**
 * Snapshot capture for completed results and active manual optimizations.
 *
 * @since 0.1.0
 */
import * as History from "@scenesystems/effect-study/History"
import { Effect } from "effect"

import * as GenericStudy from "@scenesystems/effect-study/Study"
import * as OptimizationSnapshot from "../../OptimizationSnapshot.js"
import * as Sampler from "../../Sampler.js"
import type { SearchError } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
import type { HandleRuntime } from "./askTellState.js"
import { snapshotMetadataFromOptions } from "./runtime/snapshotMetadata.js"

export const snapshotOptimization = <Space extends SearchSpace.SearchSpace>(
  state: HandleRuntime<Space>
): Effect.Effect<OptimizationSnapshot.OptimizationSnapshot, SearchError> =>
  Effect.gen(function*() {
    const samplerCheckpoint = yield* Sampler.checkpoint(state.optimizePlan.sampler)
    const metadata = snapshotMetadataFromOptions(state.optimizePlan, state.settings, samplerCheckpoint)

    return OptimizationSnapshot.make(History.values((yield* GenericStudy.read(state.runtime.study)).history), metadata)
  })
