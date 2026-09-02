/**
 * Snapshot capture for completed results and active manual studies.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"

import type { SearchError } from "../../../Errors/index.js"
import * as Sampler from "../../../Sampler/index.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import { readStudyState } from "../../runtime/runtimeState.js"
import { snapshotMetadataFromOptions } from "../../runtime/snapshotMetadata.js"
import { snapshotFromTrials, type StudySnapshot } from "../../snapshot/versioning.js"
import { trialsFromState } from "../../state.js"
import { snapshot as snapshotFromResult } from "../execute.js"
import type { StudyResult } from "../result.js"
import { isStudyHandle, stateOf, type StudyHandle } from "./model.js"

const snapshotFromHandle = <Space extends SearchSpace.SearchSpace>(
  handle: StudyHandle<Space>
): Effect.Effect<StudySnapshot, SearchError> =>
  Effect.gen(function*() {
    const state = stateOf(handle)
    const samplerCheckpoint = yield* Sampler.checkpoint(state.optimizePlan.sampler)
    const metadata = snapshotMetadataFromOptions(state.optimizePlan, state.settings, samplerCheckpoint)

    return snapshotFromTrials(trialsFromState(yield* readStudyState(state.runtime)), metadata)
  })

/**
 * Captures a versioned snapshot from an immutable study result.
 *
 * @typeParam Config - Decoded configuration stored in the result's trial history.
 *
 * @since 0.1.0
 * @category combinators
 */
export function snapshot<Config>(value: StudyResult<Config>): Effect.Effect<StudySnapshot>
/**
 * Captures the sampler checkpoint followed by current trial state. The handle
 * remains open and continues to own subsequent mutations. These reads are not
 * atomic with concurrent `ask`, `tell`, or `fail` calls; serialize snapshot
 * capture with those operations when the snapshot will be resumed.
 *
 * @typeParam Space - Search space retained by the handle whose state is captured.
 *
 * @since 0.1.0
 * @category combinators
 */
export function snapshot<Space extends SearchSpace.SearchSpace>(
  value: StudyHandle<Space>
): Effect.Effect<StudySnapshot, SearchError>
export function snapshot<Config, Space extends SearchSpace.SearchSpace>(
  value: StudyResult<Config> | StudyHandle<Space>
): Effect.Effect<StudySnapshot, SearchError> {
  return isStudyHandle(value) ? snapshotFromHandle(value) : snapshotFromResult(value)
}
