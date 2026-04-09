import { Effect, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import {
  piMonoChatContinuationRowFixture,
  piMonoTaskFirstRowFixture,
  piShareHfManifestFixture,
  piShareHfReviewSidecarFixture
} from "../../../../../../../packages/effect-dsp/test/fixtures/open-agent-trace/pi-mono/fixtures.js"
import { ConsumerArtifact } from "../../../../contracts/study/workflow/consumer-artifact.js"
import {
  chatContinuationOpenAgentTraceEntryId,
  OpenAgentTraceRegistryEntry,
  OpenAgentTraceRegistrySchema,
  taskFirstOpenAgentTraceEntryId
} from "../../../../contracts/study/workflow/open-agent-trace.js"
import { WorkflowHookup } from "../../../../contracts/study/workflow/workflow-hookup.js"

const datasetAuthority = {
  datasetId: "badlogicgames/pi-mono",
  datasetRevision: "main",
  split: "train",
  sourceUrl: "https://huggingface.co/datasets/badlogicgames/pi-mono",
  licenseTag: "cc-by-4.0"
}

const decodeFixtureInputs = Effect.all({
  manifestEntry: Experimental.OpenAgentTrace.PiMono.decodeManifestEntry(piShareHfManifestFixture),
  reviewSidecar: Experimental.OpenAgentTrace.PiMono.decodeReviewSidecar(piShareHfReviewSidecarFixture)
})

const publishedRecord = (record: typeof Experimental.OpenAgentTrace.OpenAgentTraceRecord.Type) =>
  Experimental.OpenAgentTrace.OpenAgentTraceRecord.make({
    ...record,
    reviewStatus: Experimental.OpenAgentTrace.publishedReviewStatus(record.reviewStatus)
  })

const buildRegistryEntry = (options: {
  readonly entryId: OpenAgentTraceRegistryEntry["entryId"]
  readonly eyebrow: string
  readonly rowFixture: unknown
  readonly summary: string
  readonly title: string
}) =>
  Effect.gen(function*() {
    const fixtures = yield* decodeFixtureInputs
    const row = yield* Experimental.OpenAgentTrace.PiMono.decodeDatasetRow(options.rowFixture)
    const normalizedRecord = yield* Experimental.OpenAgentTrace.PiMono.normalizeDatasetRow({
      ...datasetAuthority,
      manifestEntry: fixtures.manifestEntry,
      reviewSidecar: fixtures.reviewSidecar,
      row
    })
    const record = publishedRecord(normalizedRecord)
    const workflowProjection = yield* Experimental.OpenAgentTrace.WorkflowProjection.project(record)

    return OpenAgentTraceRegistryEntry.make({
      entryId: options.entryId,
      eyebrow: options.eyebrow,
      title: options.title,
      summary: options.summary,
      consumerArtifact: ConsumerArtifact.make({
        artifactId: record.session.sessionId,
        artifactKind: "agent-trace",
        sourceKind: "hugging-face-dataset",
        sourceLabel: record.source.datasetId,
        sourceUrl: record.source.sourceUrl,
        title: options.title,
        summary: options.summary
      }),
      workflowHookup: WorkflowHookup.make({
        artifactKind: "agent-trace",
        sourceKind: "open-agent-trace",
        transport: "registry",
        workflowKind: workflowProjection.workflowRecord.workflowKind
      }),
      record,
      workflowProjection
    })
  })

export const loadOpenAgentTraceRegistry = Effect.gen(function*() {
  const registry = yield* Effect.all(
    [
      buildRegistryEntry({
        entryId: taskFirstOpenAgentTraceEntryId,
        eyebrow: "Task-first corpus proof",
        rowFixture: piMonoTaskFirstRowFixture,
        title: "Task-First Runtime Trace",
        summary:
          "Read-only corpus proof over the task-first pi-mono fixture, including branch lineage, compaction evidence, coverage gaps, and the reusable workflow projection."
      }),
      buildRegistryEntry({
        entryId: chatContinuationOpenAgentTraceEntryId,
        eyebrow: "Chat-continuation handoff",
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
