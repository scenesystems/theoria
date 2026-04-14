import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import { appRequestRoute } from "../../app/contracts/request-route.js"
import { ConsumerArtifact } from "../../app/contracts/study/workflow/consumer-artifact.js"
import {
  AmpThreadImportPayload,
  canonicalAmpThreadSourceUrl,
  OpenAgentTraceCorpusLane,
  OpenAgentTraceRegistryEntry,
  OpenAgentTraceThreadImportRoute,
  requestFromInput
} from "../../app/contracts/study/workflow/open-agent-trace.js"
import { WorkflowHookup } from "../../app/contracts/study/workflow/workflow-hookup.js"
import { loadOpenAgentTraceRegistry } from "../../app/server/study/workflow/open-agent-trace/registry.js"
import { ampThreadImportRequestFixture } from "../helpers/open-agent-trace-amp-thread-fixture.js"

describe("Theoria OpenAgentTrace Amp Thread Import Contracts", () => {
  it.effect("publishes an Amp thread import request and route under the open-agent-trace contract family", () =>
    Effect.gen(function*() {
      const fromId = yield* requestFromInput(ampThreadImportRequestFixture.threadId)
      const fromUrl = yield* requestFromInput(
        `https://ampcode.com/v2/workspace/theoria/${ampThreadImportRequestFixture.threadId}`
      )

      expect(fromId).toEqual(ampThreadImportRequestFixture)
      expect(fromUrl.threadId).toBe(ampThreadImportRequestFixture.threadId)
      expect(fromUrl.sourceUrl).toBe(canonicalAmpThreadSourceUrl(ampThreadImportRequestFixture.threadId))
      expect(OpenAgentTraceThreadImportRoute.matches(OpenAgentTraceThreadImportRoute.pathname())).toBe(true)
      expect(appRequestRoute(OpenAgentTraceThreadImportRoute.pathname())._tag).toBe("thread-import")
    }))

  it.effect("extends consumer-artifact source kinds, import transport, and corpus-lane state for additive imported traces", () =>
    Effect.gen(function*() {
      const registry = yield* loadOpenAgentTraceRegistry
      const baseEntry = Option.fromNullable(registry[0])

      expect(Option.isSome(baseEntry)).toBe(true)

      if (Option.isNone(baseEntry)) {
        return
      }

      const importedEntry = OpenAgentTraceRegistryEntry.make({
        ...baseEntry.value,
        consumerArtifact: ConsumerArtifact.make({
          ...baseEntry.value.consumerArtifact,
          sourceKind: "amp-thread",
          sourceLabel: `Amp thread ${ampThreadImportRequestFixture.threadId}`,
          sourceUrl: ampThreadImportRequestFixture.sourceUrl,
          title: `Imported ${baseEntry.value.title}`
        }),
        title: `Imported ${baseEntry.value.title}`,
        workflowHookup: WorkflowHookup.make({
          ...baseEntry.value.workflowHookup,
          transport: "import"
        })
      })
      const payload = AmpThreadImportPayload.single(importedEntry)
      const importedCatalog = payload.catalog()

      expect(importedCatalog.consumerArtifacts[0]?.sourceKind).toBe("amp-thread")
      expect(importedCatalog.workflowHookups[0]?.transport).toBe("import")
      expect(OpenAgentTraceCorpusLane.project(importedCatalog.registry).label).toBe("import-backed")
    }))
})
