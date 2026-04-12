import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { appRequestRoute } from "../../app/contracts/request-route.js"
import {
  OpenAgentTraceConsumerArtifactRoute,
  OpenAgentTraceCoverageSchema,
  OpenAgentTraceRecordSchema,
  OpenAgentTraceRegistryRoute,
  OpenAgentTraceRegistrySchema,
  OpenAgentTraceWorkflowHookupRoute,
  OpenAgentTraceWorkflowProjectionSchema
} from "../../app/contracts/study/workflow/open-agent-trace.js"
import { loadOpenAgentTraceRegistry } from "../../app/server/study/workflow/open-agent-trace/registry.js"

describe("Theoria OpenAgentTrace Contracts", () => {
  it.effect("reuses the package-owned normalized record, workflow projection, and coverage schemas without app-local redefinition", () =>
    Effect.gen(function*() {
      const registry = yield* loadOpenAgentTraceRegistry
      const decoded = yield* Schema.decodeUnknown(OpenAgentTraceRegistrySchema)(registry)

      expect(OpenAgentTraceRecordSchema).toBe(Experimental.OpenAgentTrace.Record)
      expect(OpenAgentTraceWorkflowProjectionSchema).toBe(Experimental.OpenAgentTrace.WorkflowProjection)
      expect(OpenAgentTraceCoverageSchema).toBe(Experimental.OpenAgentTrace.Coverage)
      expect(decoded.every((entry) => Schema.is(OpenAgentTraceRecordSchema)(entry.record))).toBe(true)
      expect(
        decoded.every((entry) => Schema.is(OpenAgentTraceWorkflowProjectionSchema)(entry.workflowProjection))
      ).toBe(true)
      expect(decoded[0]?.record.source.datasetId).toBe("badlogicgames/pi-mono")
      expect(decoded[0]?.workflowProjection.workflowRecord.workflowKind).toBe("task-first")
      expect(decoded[1]?.workflowProjection.workflowRecord.workflowKind).toBe("chat-continuation")
    }))

  it("routes open-agent-trace API pathnames through the route nouns and the request-router boundary", () => {
    const registryRoute = OpenAgentTraceRegistryRoute.fromPathname(OpenAgentTraceRegistryRoute.pathname())
    const consumerArtifactRoute = OpenAgentTraceConsumerArtifactRoute.fromPathname(
      OpenAgentTraceConsumerArtifactRoute.pathname()
    )
    const workflowHookupRoute = OpenAgentTraceWorkflowHookupRoute.fromPathname(
      OpenAgentTraceWorkflowHookupRoute.pathname()
    )

    expect(Option.isSome(registryRoute)).toBe(true)
    expect(Option.isSome(consumerArtifactRoute)).toBe(true)
    expect(Option.isSome(workflowHookupRoute)).toBe(true)
    expect(appRequestRoute(OpenAgentTraceRegistryRoute.pathname())._tag).toBe("registry")
    expect(appRequestRoute(OpenAgentTraceConsumerArtifactRoute.pathname())._tag).toBe("consumer-artifacts")
    expect(appRequestRoute(OpenAgentTraceWorkflowHookupRoute.pathname())._tag).toBe("workflow-hookups")
  })
})
