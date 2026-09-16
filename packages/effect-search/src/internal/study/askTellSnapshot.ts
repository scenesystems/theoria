/**
 * Snapshot capture for completed results and active manual studies.
 *
 * @since 0.1.0
 */
import * as History from "@scenesystems/effect-study/History"
import { Effect } from "effect"

import * as Sampler from "../../Sampler.js"
import type { SearchError } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
import type { Study } from "../../Study.js"
import * as StudySnapshot from "../../StudySnapshot.js"
import { stateOf } from "./askTellState.js"
import { readStudyState } from "./runtime/runtimeState.js"
import { snapshotMetadataFromOptions } from "./runtime/snapshotMetadata.js"

export const snapshotStudy = <Space extends SearchSpace.SearchSpace>(
  handle: Study<Space>
): Effect.Effect<StudySnapshot.Snapshot, SearchError> =>
  Effect.gen(function*() {
    const state = stateOf(handle)
    const samplerCheckpoint = yield* Sampler.checkpoint(state.optimizePlan.sampler)
    const metadata = snapshotMetadataFromOptions(state.optimizePlan, state.settings, samplerCheckpoint)

    return StudySnapshot.make(History.values(yield* readStudyState(state.runtime)), metadata)
  })
