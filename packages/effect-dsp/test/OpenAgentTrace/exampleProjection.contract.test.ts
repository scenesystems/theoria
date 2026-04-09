/**
 * Contract for optimization-ready example projection over normalized traces.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { piMonoTaskFirstRowFixture, piShareHfManifestFixture } from "../fixtures/open-agent-trace/pi-mono/fixtures.js"

describe("OpenAgentTrace/exampleProjection", () => {
  it.effect("projects normalized traces into evaluation examples and objective-ready comparison cases without re-owning workflow semantics", () =>
    Effect.gen(function*() {
      const manifestEntry = yield* Experimental.OpenAgentTrace.PiMono.decodeManifestEntry(piShareHfManifestFixture)
      const record = yield* Experimental.OpenAgentTrace.PiMono.normalizeDatasetRow({
        datasetId: "badlogicgames/pi-mono",
        datasetRevision: "main",
        split: "train",
        sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
        licenseTag: "other",
        row: yield* Experimental.OpenAgentTrace.PiMono.decodeDatasetRow(piMonoTaskFirstRowFixture),
        manifestEntry
      })
      const workflowProjection = yield* Experimental.OpenAgentTrace.Workflow.project(record)
      const projection = yield* Experimental.OpenAgentTrace.Examples.project(record)
      const roundTrip = yield* Schema.decode(Experimental.OpenAgentTrace.ExampleProjection)(
        yield* Schema.encode(Experimental.OpenAgentTrace.ExampleProjection)(projection)
      )

      expect(roundTrip).toStrictEqual(projection)
      expect(projection.workflowKind).toBe("task-first")
      expect(projection.examples).toHaveLength(1)
      expect(projection.examples[0]?.input).toEqual(
        expect.objectContaining({ prompt: "Summarize the surviving fix path.", workflowKind: "task-first" })
      )
      expect(projection.comparisonCases.map((value) => value.caseId)).toEqual(["0000000d"])
      expect(projection.optimizationKnobs).toStrictEqual(workflowProjection.workflowRecord.graph.optimizationKnobs)
      expect(projection.optimizationKnobs.map((value) => value.kind)).toEqual([
        "instruction-profile",
        "response-length-target"
      ])
      expect(
        projection.optimizationKnobs.some((value) => value.kind === "node-enabled" || value.kind === "tool-routing")
      ).toBe(false)
      expect(Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(projection.examplesDigest)).toContain(
        "blake3-256:"
      )
      expect(Experimental.OpenAgentTrace.formatOpenAgentTraceContentDigest(projection.comparisonCasesDigest)).toContain(
        "blake3-256:"
      )
    }))
})
