import { Effect, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import {
  piMonoChatContinuationRowFixture,
  piMonoTaskFirstRowFixture,
  piShareHfManifestFixture,
  piShareHfReviewSidecarFixture
} from "../../../../../packages/effect-dsp/test/fixtures/open-agent-trace/pi-mono/fixtures.js"
import {
  type OpenAgentTraceRegistryEntry,
  OpenAgentTraceRegistryEntrySchema,
  OpenAgentTraceRegistrySchema
} from "../../contracts/open-agent-trace.js"

const datasetAuthority = {
  datasetId: "badlogicgames/pi-mono",
  datasetRevision: "main",
  split: "train",
  sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
  licenseTag: "cc-by-4.0"
}

const decodeFixtureInputs = Effect.all({
  manifestEntry: Experimental.OpenAgentTrace.decodePiShareHfManifestEntry(piShareHfManifestFixture),
  reviewSidecar: Experimental.OpenAgentTrace.decodePiShareHfReviewSidecar(piShareHfReviewSidecarFixture)
})

const publishedRecord = (record: typeof Experimental.OpenAgentTrace.OpenAgentTraceRecord.Type) =>
  new Experimental.OpenAgentTrace.OpenAgentTraceRecord({
    ...record,
    reviewStatus: Experimental.OpenAgentTrace.publishedOpenAgentTraceReviewStatus(record.reviewStatus)
  })

const buildRegistryEntry = (options: {
  readonly entryId: OpenAgentTraceRegistryEntry["entryId"]
  readonly rowFixture: unknown
  readonly summary: string
  readonly title: string
}) =>
  Effect.gen(function*() {
    const fixtures = yield* decodeFixtureInputs
    const row = yield* Experimental.OpenAgentTrace.decodePiMonoDatasetRow(options.rowFixture)
    const normalizedRecord = yield* Experimental.OpenAgentTrace.normalizePiMonoDatasetRow({
      ...datasetAuthority,
      manifestEntry: fixtures.manifestEntry,
      reviewSidecar: fixtures.reviewSidecar,
      row
    })
    const record = publishedRecord(normalizedRecord)
    const workflowProjection = yield* Experimental.OpenAgentTrace.projectOpenAgentTraceToWorkflow(record)

    return yield* Schema.decodeUnknown(OpenAgentTraceRegistryEntrySchema)({
      entryId: options.entryId,
      title: options.title,
      summary: options.summary,
      record,
      workflowProjection
    })
  })

export const loadOpenAgentTraceRegistry = Effect.gen(function*() {
  const registry = yield* Effect.all(
    [
      buildRegistryEntry({
        entryId: "task-first",
        rowFixture: piMonoTaskFirstRowFixture,
        title: "Task-First Runtime Trace",
        summary:
          "Read-only corpus proof over the task-first pi-mono fixture, including branch lineage, compaction evidence, coverage gaps, and the reusable workflow projection."
      }),
      buildRegistryEntry({
        entryId: "chat-continuation",
        rowFixture: piMonoChatContinuationRowFixture,
        title: "Chat-Continuation Handoff Trace",
        summary:
          "Read-only corpus proof over the chat-continuation pi-mono fixture, showing the same package-owned workflow family without app-local shape translation."
      })
    ],
    { concurrency: 1 }
  )

  return yield* Schema.decodeUnknown(OpenAgentTraceRegistrySchema)(registry)
})
