/**
 * Replay-safe execution harness backed by checked-in Amp captures.
 *
 * @since 0.2.0
 */
import { Path } from "@effect/platform"
import { Effect } from "effect"

import { normalizeCapture } from "../../adapter.js"
import { loadPluginAdapterCapture, pluginAdapter } from "../../amp/index.js"
import type { OpenAgentTraceRecord } from "../../schema.js"
import { COUNTER_ITEMS_EXECUTION_FIXTURE_ID, loadCodingExecutionFixture } from "./fixture.js"
import { judgeCodingExecutionFixture } from "./judge.js"
import type { CodingExecutionFixture as CodingExecutionFixtureModel, CodingExecutionJudgeResult } from "./schema.js"

/**
 * Replay-safe execution evidence emitted from the checked-in fixture harness.
 *
 * @since 0.2.0
 * @category models
 */
export type CodingExecutionHarnessResult = Readonly<{
  readonly fixture: CodingExecutionFixtureModel
  readonly record: OpenAgentTraceRecord
  readonly judge: CodingExecutionJudgeResult
}>

/**
 * Run the package-owned replay harness for one checked-in execution fixture.
 *
 * @since 0.2.0
 * @category constructors
 */
export const runCodingExecutionReplayHarness = (options: {
  readonly fixtureId?: string
  readonly applyPatch: boolean
}) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const fixtureId = options.fixtureId ?? COUNTER_ITEMS_EXECUTION_FIXTURE_ID
    const resolved = yield* loadCodingExecutionFixture(fixtureId)
    const ampFixtureRoot = path.join(
      path.dirname(path.dirname(path.dirname(resolved.directory))),
      "amp"
    )
    const capture = yield* loadPluginAdapterCapture(ampFixtureRoot, resolved.fixture.sourceThreadId)
    const normalized = yield* normalizeCapture(pluginAdapter, capture)
    const judge = yield* judgeCodingExecutionFixture({ fixtureId, applyPatch: options.applyPatch })

    return {
      fixture: resolved.fixture,
      record: normalized.record,
      judge
    }
  })
