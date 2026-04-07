/**
 * Contract for artifact-envelope transport over trace-derived payloads.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"
import * as SearchContracts from "effect-search/Contracts"

import {
  piMonoTaskFirstRowFixture,
  piShareHfManifestFixture,
  piShareHfReviewSidecarFixture
} from "../fixtures/open-agent-trace/pi-mono/fixtures.js"

describe("OpenAgentTrace/artifactEnvelope", () => {
  it.effect("wraps normalized records and workflow projections in effect-search ArtifactEnvelope.Custom without moving trace ownership into effect-search", () =>
    Effect.gen(function*() {
      const runId = yield* Schema.decode(SearchContracts.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
      const packageVersion = yield* Schema.decode(SearchContracts.PackageVersion)("0.1.4")
      const emittedAt = yield* Schema.decode(Schema.DateTimeUtc)("2026-04-06T18:30:00.000Z")
      const manifestEntry = yield* Experimental.OpenAgentTrace.decodePiShareHfManifestEntry(piShareHfManifestFixture)
      const reviewSidecar = yield* Experimental.OpenAgentTrace.decodePiShareHfReviewSidecar(
        piShareHfReviewSidecarFixture
      )
      const record = yield* Experimental.OpenAgentTrace.normalizePiMonoDatasetRow({
        datasetId: "badlogicgames/pi-mono",
        datasetRevision: "main",
        split: "train",
        sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
        licenseTag: "other",
        row: yield* Experimental.OpenAgentTrace.decodePiMonoDatasetRow(piMonoTaskFirstRowFixture),
        manifestEntry,
        reviewSidecar
      })
      const workflowProjection = yield* Experimental.OpenAgentTrace.projectOpenAgentTraceToWorkflow(record)
      const recordEnvelope = yield* Experimental.OpenAgentTrace.projectOpenAgentTraceToArtifact({
        record,
        packageVersion,
        runId,
        sequence: 0,
        emittedAt
      })
      const workflowEnvelope = yield* Experimental.OpenAgentTrace.projectOpenAgentTraceToArtifact({
        record,
        projection: workflowProjection,
        packageVersion,
        runId,
        sequence: 1,
        emittedAt
      })
      expect(recordEnvelope._tag).toBe("Custom")
      expect(workflowEnvelope._tag).toBe("Custom")

      if (recordEnvelope._tag !== "Custom" || workflowEnvelope._tag !== "Custom") {
        return
      }

      const decodedRecordPayload = yield* Schema.decodeUnknown(
        Experimental.OpenAgentTrace.OpenAgentTraceArtifactPayload
      )(recordEnvelope.payload)
      const decodedWorkflowPayload = yield* Schema.decodeUnknown(
        Experimental.OpenAgentTrace.OpenAgentTraceArtifactPayload
      )(workflowEnvelope.payload)

      expect(recordEnvelope.producer._tag).toBe("EffectDsp")
      expect(workflowEnvelope.producer._tag).toBe("EffectDsp")
      expect(recordEnvelope.lineage.integrity).toStrictEqual(record.source.redactedHash)
      expect(recordEnvelope.relations?.map((relation) => relation._tag)).toEqual(["External", "External", "External"])
      expect(decodedRecordPayload.artifactKind).toBe("open-agent-trace-record")
      expect(decodedWorkflowPayload.artifactKind).toBe("open-agent-trace-workflow-projection")
      expect(
        decodedRecordPayload.artifactKind === "open-agent-trace-record"
          ? decodedRecordPayload.record.reviewStatus.reviewKey
          : undefined
      ).toBeUndefined()
      expect(
        decodedWorkflowPayload.artifactKind === "open-agent-trace-workflow-projection"
          ? decodedWorkflowPayload.projection.workflowRecord.workflowKind
          : undefined
      ).toBe("task-first")
      expect(
        decodedWorkflowPayload.artifactKind === "open-agent-trace-workflow-projection"
          ? decodedWorkflowPayload.projection.usageProvenance[0]?.cacheReadTokens
          : undefined
      ).toBe(16)
      expect(
        decodedWorkflowPayload.artifactKind === "open-agent-trace-workflow-projection"
          ? decodedWorkflowPayload.projection.usageProvenance[0]?.costUsd
          : undefined
      ).toBe(0.00294)
    }))
})
