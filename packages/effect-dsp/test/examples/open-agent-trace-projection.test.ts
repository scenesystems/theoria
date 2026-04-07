/**
 * Example contract: open-agent-trace projection story.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"
import * as SearchContracts from "effect-search/Contracts"

import { piMonoTaskFirstRowFixture, piShareHfManifestFixture } from "../fixtures/open-agent-trace/pi-mono/fixtures.js"

describe("examples/21-open-agent-trace-projection", () => {
  it.effect("normalizes a checked-in pi-mono fixture, projects bounded optimization inputs, and emits artifact-ready summaries", () =>
    Effect.gen(function*() {
      const manifestEntry = yield* Experimental.OpenAgentTrace.decodePiShareHfManifestEntry(piShareHfManifestFixture)
      const record = yield* Experimental.OpenAgentTrace.normalizePiMonoDatasetRow({
        datasetId: "badlogicgames/pi-mono",
        datasetRevision: "main",
        split: "train",
        sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
        licenseTag: "other",
        row: yield* Experimental.OpenAgentTrace.decodePiMonoDatasetRow(piMonoTaskFirstRowFixture),
        manifestEntry
      })
      const workflowProjection = yield* Experimental.OpenAgentTrace.projectOpenAgentTraceToWorkflow(record)
      const exampleProjection = yield* Experimental.OpenAgentTrace.projectOpenAgentTraceToExamples(record)
      const runId = yield* Schema.decode(SearchContracts.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
      const packageVersion = yield* Schema.decode(SearchContracts.PackageVersion)("0.1.4")
      const emittedAt = yield* Schema.decode(Schema.DateTimeUtc)("2026-04-06T18:30:00.000Z")
      const artifact = yield* Experimental.OpenAgentTrace.projectOpenAgentTraceToArtifact({
        record,
        projection: exampleProjection,
        packageVersion,
        runId,
        sequence: 1,
        emittedAt
      })

      expect(workflowProjection.workflowRecord.workflowKind).toBe("task-first")
      expect(exampleProjection.optimizationKnobs.map((value) => value.key)).toEqual([
        "instruction-profile",
        "response-length-target"
      ])
      expect(exampleProjection.comparisonCases.map((value) => value.caseId)).toEqual(["0000000d"])
      expect(exampleProjection.coverageGaps.map((gap) => gap.sourceKind)).toEqual([
        "compaction",
        "branch-summary",
        "custom-message",
        "label",
        "session-info",
        "image"
      ])
      expect(artifact._tag).toBe("Custom")
    }))
})
