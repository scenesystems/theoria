import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { appRequestRoute } from "../../app/contracts/request-route.js"
import { ConsumerArtifact } from "../../app/contracts/study/workflow/consumer-artifact.js"
import {
  OpenAgentTraceCatalog,
  OpenAgentTraceConsumerArtifactRoute,
  OpenAgentTraceCorpusLane,
  OpenAgentTraceCoverageSchema,
  OpenAgentTracePanelData,
  OpenAgentTraceRecordSchema,
  OpenAgentTraceRegistryEntry,
  OpenAgentTraceRegistryRoute,
  OpenAgentTraceRegistrySchema,
  OpenAgentTraceWorkflowHookupRoute,
  OpenAgentTraceWorkflowProjectionSchema
} from "../../app/contracts/study/workflow/open-agent-trace.js"
import { WorkflowHookup } from "../../app/contracts/study/workflow/workflow-hookup.js"
import { loadOpenAgentTraceRegistry } from "../../app/server/study/workflow/open-agent-trace/registry.js"

describe("Theoria OpenAgentTrace Contracts", () => {
  it.effect("reuses the package-owned normalized record, workflow projection, and coverage schemas without app-local redefinition", () =>
    Effect.gen(function*() {
      const registry = yield* loadOpenAgentTraceRegistry
      const decoded = yield* Schema.decodeUnknown(OpenAgentTraceRegistrySchema)(registry)
      const workflowKinds = decoded.map((entry) => entry.workflowProjection.workflowRecord.workflowKind)

      expect(OpenAgentTraceRecordSchema).toBe(Experimental.OpenAgentTrace.Record)
      expect(OpenAgentTraceWorkflowProjectionSchema).toBe(Experimental.OpenAgentTrace.WorkflowProjection)
      expect(OpenAgentTraceCoverageSchema).toBe(Experimental.OpenAgentTrace.Coverage)
      expect(decoded.every((entry) => Schema.is(OpenAgentTraceRecordSchema)(entry.record))).toBe(true)
      expect(
        decoded.every((entry) => Schema.is(OpenAgentTraceWorkflowProjectionSchema)(entry.workflowProjection))
      ).toBe(true)
      expect(decoded.every((entry) => entry.entryId === entry.record.recordId)).toBe(true)
      expect(decoded.every((entry) => entry.workflowHookup.transport === "registry")).toBe(true)
      expect(workflowKinds).toContain("task-first")
      expect(workflowKinds).toContain("chat-continuation")
      expect(decoded.some((entry) => entry.record.source.datasetId === "badlogicgames/pi-mono")).toBe(true)
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

  it.effect("derives corpus-lane state from registry versus imported transport composition", () =>
    Effect.gen(function*() {
      const registry = yield* loadOpenAgentTraceRegistry
      const importedRegistry = registry.map((entry) =>
        OpenAgentTraceRegistryEntry.make({
          ...entry,
          workflowHookup: WorkflowHookup.make({
            ...entry.workflowHookup,
            transport: "import"
          })
        })
      )

      expect(OpenAgentTraceCorpusLane.project([]).label).toBe("empty")
      expect(OpenAgentTraceCorpusLane.project(registry).label).toBe("fixture-backed")
      expect(OpenAgentTraceCorpusLane.project(importedRegistry).label).toBe("import-backed")
      expect(OpenAgentTraceCorpusLane.project([registry[0]!, importedRegistry[0]!]).label).toBe("mixed")
    }))

  it.effect("appends imported trace catalogs locally so mixed-corpus panel data can stay browser-session scoped", () =>
    Effect.gen(function*() {
      const registry = yield* loadOpenAgentTraceRegistry
      const fixtureEntry = registry[0]!
      const importedSourceEntry = registry[1]!
      const importedEntry = OpenAgentTraceRegistryEntry.make({
        ...importedSourceEntry,
        consumerArtifact: ConsumerArtifact.make({
          ...importedSourceEntry.consumerArtifact,
          sourceKind: "amp-thread",
          sourceLabel: "Imported Amp thread",
          title: `Imported ${importedSourceEntry.consumerArtifact.title}`
        }),
        title: `Imported ${importedSourceEntry.title}`,
        workflowHookup: WorkflowHookup.make({
          ...importedSourceEntry.workflowHookup,
          transport: "import"
        })
      })
      const fixtureCatalog = OpenAgentTraceCatalog.fromParts({
        consumerArtifacts: [fixtureEntry.consumerArtifact],
        registry: [fixtureEntry],
        workflowHookups: [fixtureEntry.workflowHookup]
      })
      const importedCatalog = OpenAgentTraceCatalog.fromParts({
        consumerArtifacts: [importedEntry.consumerArtifact],
        registry: [importedEntry],
        workflowHookups: [importedEntry.workflowHookup]
      })
      const mergedPanelData = OpenAgentTracePanelData.fromCatalog(fixtureCatalog.append(importedCatalog))

      expect(mergedPanelData.registry).toHaveLength(2)
      expect(OpenAgentTraceCorpusLane.project(mergedPanelData.registry).label).toBe("mixed")
      expect(mergedPanelData.studyMaterialCount("consumer-artifacts")).toBe(2)
      expect(mergedPanelData.studyMaterialCount("workflow-hookups")).toBe(2)
      expect(importedEntry.consumerArtifact.sourceFamilyLabel()).toBe("Amp thread")
    }))
})
