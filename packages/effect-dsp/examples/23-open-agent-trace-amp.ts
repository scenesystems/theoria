/**
 * Normalize checked-in Amp fixtures into canonical OpenAgentTrace records and project
 * them through workflow and coding lanes.
 *
 * Run: bun run examples/23-open-agent-trace-amp.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { loadPluginAdapterCapture } from "../fixtures/open-agent-trace/amp/index.js"

const program = Effect.gen(function*() {
  const pluginCapture = yield* loadPluginAdapterCapture()
  const normalized = yield* Experimental.OpenAgentTrace.normalizeCapture(
    Experimental.OpenAgentTrace.Amp.pluginAdapter,
    pluginCapture
  )
  const workflowProjection = yield* Experimental.OpenAgentTrace.WorkflowProjection.project(normalized.record)
  const codingTask = Experimental.OpenAgentTrace.projectCodingTask(normalized.record)
  const codingEvidence = Experimental.OpenAgentTrace.projectCodingEvidence(normalized.record)
  const codingOutcome = Experimental.OpenAgentTrace.projectCodingOutcome(normalized.record, codingEvidence)

  yield* Effect.log("open-agent-trace-amp", {
    recordId: normalized.record.recordId,
    workflowKind: workflowProjection.workflowRecord.workflowKind,
    codingTask: codingTask.summary,
    commandCount: codingEvidence.commandCount,
    outcome: codingOutcome.outcome,
    coverageKinds: normalized.coverageGaps.map((gap) => gap.sourceKind)
  })
})

BunRuntime.runMain(program)
