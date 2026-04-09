import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, DateTime, Effect, Schema } from "effect"

import * as SearchContracts from "effect-search/Contracts"

import * as Contracts from "../../src/contracts/index.js"

import { taskFirstWorkflowRecord } from "./workflowFixtures.js"

const testRunId = "01HZ0000000000000000000000"

const testLineage = Effect.gen(function*() {
  const runId = yield* Schema.decode(SearchContracts.RunId)(testRunId)
  const sourceRef = new SearchContracts.SourceRef({
    origin: "external",
    domain: "workflow-record",
    segments: ["effect-inference", "search-seam"]
  })
  const artifactId = new SearchContracts.ArtifactId({
    runId,
    sequence: 0
  })

  return new SearchContracts.ArtifactLineage({
    sourceRef,
    artifactId,
    emittedAt: DateTime.unsafeMake("2024-01-01T00:00:00Z")
  })
})

const testProducer = Effect.gen(function*() {
  const packageVersion = yield* Schema.decode(SearchContracts.PackageVersion)("0.2.1")
  const runId = yield* Schema.decode(SearchContracts.RunId)(testRunId)
  const component = yield* Schema.decode(SearchContracts.ComponentPath)(["Workflow", "searchSeam"])

  return SearchContracts.EffectSearch({
    packageVersion,
    component,
    runId
  })
})

describe("integration/workflow-search-seam", () => {
  it.effect("rides workflow records through the canonical effect-search artifact envelope", () =>
    Effect.gen(function*() {
      const record = yield* Schema.decodeUnknown(Contracts.WorkflowExecutionRecordSchema)(taskFirstWorkflowRecord)
      const encodedRecordJson = yield* Schema.encode(Schema.parseJson(Contracts.WorkflowExecutionRecordSchema))(record)
      const lineage = yield* testLineage
      const producer = yield* testProducer
      const envelope = SearchContracts.Custom({
        schemaVersion: "artifact-envelope/v1",
        producer,
        lineage,
        payload: {
          workflowExecutionRecordJson: encodedRecordJson
        }
      })
      const encodedEnvelope = yield* Schema.encode(SearchContracts.ArtifactEnvelopeSchema)(envelope)

      expect(encodedEnvelope._tag).toBe("Custom")

      if (encodedEnvelope._tag !== "Custom") {
        return
      }

      const payload = encodedEnvelope.payload

      if (
        typeof payload !== "object"
        || payload === null
        || Arr.isArray(payload)
        || !("workflowExecutionRecordJson" in payload)
        || typeof payload.workflowExecutionRecordJson !== "string"
      ) {
        return
      }

      const decodedRecord = yield* Schema.decode(Schema.parseJson(Contracts.WorkflowExecutionRecordSchema))(
        payload.workflowExecutionRecordJson
      )

      expect(encodedEnvelope.schemaVersion).toBe("artifact-envelope/v1")
      expect(encodedEnvelope.lineage.sourceRef.origin).toBe("external")
      expect(encodedEnvelope.lineage.sourceRef.segments[0]).toBe("effect-inference")
      expect(decodedRecord.recordId).toBe(record.recordId)
      expect(decodedRecord.graph.manifestId).toBe(record.graph.manifestId)
    }))
})
