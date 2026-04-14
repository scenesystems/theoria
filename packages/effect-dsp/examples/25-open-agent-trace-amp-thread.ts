/**
 * Normalize one checked-in Amp thread export snapshot and project it through the
 * workflow lens as an evidentiary import lane distinct from raw Amp capture fixtures.
 *
 * Run: bun run examples/25-open-agent-trace-amp-thread.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { loadExportSnapshot, sourceUrl } from "../fixtures/open-agent-trace/amp-thread/index.js"

const program = Effect.gen(function*() {
  const snapshot = yield* loadExportSnapshot()
  const normalized = yield* Experimental.OpenAgentTrace.AmpThread.normalizeExportSnapshot({
    snapshot,
    sourceUrl
  })
  const workflowProjection = yield* Experimental.OpenAgentTrace.WorkflowProjection.project(normalized.record)

  yield* Effect.log("open-agent-trace-amp-thread", {
    threadId: snapshot.id,
    recordId: normalized.record.recordId,
    workflowKind: workflowProjection.workflowRecord.workflowKind,
    sessionId: workflowProjection.workflowRecord.session.sessionId,
    messageCount: snapshot.messages.length,
    coverageKinds: normalized.coverageGaps.map((gap) => gap.sourceKind)
  })
})

BunRuntime.runMain(program)
