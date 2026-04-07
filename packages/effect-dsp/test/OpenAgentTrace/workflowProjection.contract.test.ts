/**
 * Contract for workflow projection over normalized open-agent-trace records.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Redacted, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"
import { WorkflowExecutionRecordSchema } from "effect-inference/Contracts"

import {
  piMonoChatContinuationRowFixture,
  piMonoTaskFirstRowFixture,
  piShareHfManifestFixture
} from "../fixtures/open-agent-trace/pi-mono/fixtures.js"

describe("OpenAgentTrace/workflowProjection", () => {
  it.effect("projects bounded task-first and chat-continuation traces into effect-inference workflow surfaces without app-local schema translation", () =>
    Effect.gen(function*() {
      const manifestEntry = yield* Experimental.OpenAgentTrace.decodePiShareHfManifestEntry(piShareHfManifestFixture)
      const taskFirst = yield* Experimental.OpenAgentTrace.normalizePiMonoDatasetRow({
        datasetId: "badlogicgames/pi-mono",
        datasetRevision: "main",
        split: "train",
        sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
        licenseTag: "other",
        row: yield* Experimental.OpenAgentTrace.decodePiMonoDatasetRow(piMonoTaskFirstRowFixture),
        manifestEntry
      })
      const chatContinuation = yield* Experimental.OpenAgentTrace.normalizePiMonoDatasetRow({
        datasetId: "badlogicgames/pi-mono",
        datasetRevision: "main",
        split: "train",
        sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
        licenseTag: "other",
        row: yield* Experimental.OpenAgentTrace.decodePiMonoDatasetRow(piMonoChatContinuationRowFixture),
        manifestEntry
      })
      const redactedTaskFirst = yield* Experimental.OpenAgentTrace.redactOpenAgentTraceRecord({
        record: taskFirst,
        policy: new Experimental.OpenAgentTrace.OpenAgentTraceRedactionPolicy({
          policyId: "open-agent-trace-projection-proof",
          policyVersion: 1,
          imageHandling: "keep-images",
          literalSecrets: [{
            secretId: "runtime-spine",
            secretValue: Redacted.make("runtime spine"),
            replacementToken: "[REDACTED:RUNTIME-SPINE]"
          }],
          curatedPatterns: []
        })
      })
      const taskProjection = yield* Experimental.OpenAgentTrace.projectOpenAgentTraceToWorkflow(taskFirst)
      const chatProjection = yield* Experimental.OpenAgentTrace.projectOpenAgentTraceToWorkflow(chatContinuation)
      const redactedTaskProjection = yield* Experimental.OpenAgentTrace.projectOpenAgentTraceToWorkflow(
        redactedTaskFirst
      )
      const taskRoundTrip = yield* Schema.decode(WorkflowExecutionRecordSchema)(
        yield* Schema.encode(WorkflowExecutionRecordSchema)(taskProjection.workflowRecord)
      )

      expect(taskRoundTrip).toStrictEqual(taskProjection.workflowRecord)
      expect(taskProjection.workflowRecord.workflowKind).toBe("task-first")
      expect(chatProjection.workflowRecord.workflowKind).toBe("chat-continuation")
      expect(taskProjection.workflowRecord.session.turns.map((turn) => turn.turnId)).toEqual([
        "00000004",
        "0000000d",
        "0000000e"
      ])
      expect(taskProjection.coverageGaps.map((gap) => gap.sourceKind)).toEqual([
        "compaction",
        "branch-summary",
        "custom-message",
        "label",
        "session-info",
        "image"
      ])
      expect(redactedTaskProjection.coverageGaps.map((gap) => gap.sourceKind)).toEqual(
        expect.arrayContaining([
          "compaction",
          "branch-summary",
          "custom-message",
          "label",
          "session-info",
          "image",
          "redaction"
        ])
      )
      expect(redactedTaskProjection.coverageGaps.filter((gap) => gap.sourceKind === "redaction")).toHaveLength(2)
      expect(taskProjection.workflowRecord.graph.optimizationKnobs.map((knob) => knob.key)).toEqual([
        "instruction-profile",
        "response-length-target"
      ])
      expect(redactedTaskProjection.coverageGaps.find((gap) => gap.sourceKind === "redaction")?.severity).toBe(
        "warning"
      )
    }))
})
