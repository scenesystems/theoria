/**
 * Normalize one checked-in `pi-mono` fixture, project it into workflow and
 * optimization-ready example surfaces, and emit artifact-envelope-ready
 * summaries without live network access.
 *
 * Run: bun run examples/21-open-agent-trace-projection.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { Effect, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"
import * as SearchContracts from "effect-search/Contracts"

import {
  piMonoTaskFirstRowFixture,
  piShareHfManifestFixture
} from "../fixtures/open-agent-trace/pi-mono/index.js"

const program = Effect.gen(function*() {
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
  const workflowProjection = yield* Experimental.OpenAgentTrace.WorkflowProjection.project(record)
  const exampleProjection = yield* Experimental.OpenAgentTrace.ExampleProjection.project(record)
  const runId = yield* Schema.decode(SearchContracts.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
  const packageVersion = yield* Schema.decode(SearchContracts.PackageVersion)("0.1.4")
  const emittedAt = yield* Schema.decode(Schema.DateTimeUtc)("2026-04-06T18:30:00.000Z")
  const workflowArtifact = yield* Experimental.OpenAgentTrace.WorkflowProjectionArtifact.project({
    record,
    projection: workflowProjection,
    packageVersion,
    runId,
    sequence: 0,
    emittedAt
  })
  const exampleArtifact = yield* Experimental.OpenAgentTrace.ExampleProjectionArtifact.project({
    record,
    projection: exampleProjection,
    packageVersion,
    runId,
    sequence: 1,
    emittedAt
  })

  yield* Effect.log("open-agent-trace-projection", {
    recordId: record.recordId,
    workflowKind: workflowProjection.workflowRecord.workflowKind,
    optimizationKnobs: exampleProjection.optimizationKnobs.map((value) => ({
      key: value.key,
      kind: value.kind,
      choices: value.choices
    })),
    comparisonCaseIds: exampleProjection.comparisonCases.map((value) => value.caseId),
    coverageKinds: workflowProjection.coverageGaps.map((gap) => gap.sourceKind),
    artifactKinds: [workflowArtifact._tag, exampleArtifact._tag],
    usageProvenance: workflowProjection.usageProvenance.map((value) => ({
      eventId: value.eventId,
      provider: value.provider,
      model: value.model,
      cacheReadTokens: value.cacheReadTokens,
      cacheWriteTokens: value.cacheWriteTokens,
      costUsd: value.costUsd,
      cached: value.usage.cached
    }))
  })
})

BunRuntime.runMain(program)
