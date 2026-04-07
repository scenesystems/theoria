import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import {
  OpenAgentTraceCoverageSchema,
  OpenAgentTraceRecordSchema,
  OpenAgentTraceRegistrySchema,
  OpenAgentTraceWorkflowProjectionSchema
} from "../../app/contracts/open-agent-trace.js"
import { loadOpenAgentTraceRegistry } from "../../app/server/open-agent-trace/registry.js"

describe("Theoria OpenAgentTrace Contracts", () => {
  it.effect("reuses the package-owned normalized record, workflow projection, and coverage schemas without app-local redefinition", () =>
    Effect.gen(function*() {
      const registry = yield* loadOpenAgentTraceRegistry
      const decoded = yield* Schema.decodeUnknown(OpenAgentTraceRegistrySchema)(registry)

      expect(OpenAgentTraceRecordSchema).toBe(Experimental.OpenAgentTrace.OpenAgentTraceRecord)
      expect(OpenAgentTraceWorkflowProjectionSchema).toBe(Experimental.OpenAgentTrace.OpenAgentTraceWorkflowProjection)
      expect(OpenAgentTraceCoverageSchema).toBe(Experimental.OpenAgentTrace.OpenAgentTraceCoverage)
      expect(decoded.every((entry) => Schema.is(OpenAgentTraceRecordSchema)(entry.record))).toBe(true)
      expect(
        decoded.every((entry) => Schema.is(OpenAgentTraceWorkflowProjectionSchema)(entry.workflowProjection))
      ).toBe(true)
      expect(decoded[0]?.record.source.datasetId).toBe("badlogicgames/pi-mono")
      expect(decoded[0]?.workflowProjection.workflowRecord.workflowKind).toBe("task-first")
      expect(decoded[1]?.workflowProjection.workflowRecord.workflowKind).toBe("chat-continuation")
    }))
})
