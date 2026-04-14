import { Effect, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import {
  piMonoChatContinuationRowFixture,
  piMonoTaskFirstRowFixture,
  piShareHfManifestFixture,
  piShareHfReviewSidecarFixture
} from "effect-dsp/fixtures/open-agent-trace/pi-mono"
import { ConsumerArtifact } from "../../../../contracts/study/workflow/consumer-artifact.js"
import {
  OpenAgentTraceRegistryEntry,
  OpenAgentTraceRegistrySchema
} from "../../../../contracts/study/workflow/open-agent-trace.js"
import {
  registryWorkflowHookupTransport,
  WorkflowHookup
} from "../../../../contracts/study/workflow/workflow-hookup.js"

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

const publishedRecord = (record: typeof Experimental.OpenAgentTrace.Record.Type) =>
  Experimental.OpenAgentTrace.Record.make({
    ...record,
    reviewStatus: Experimental.OpenAgentTrace.publishedReviewStatus(record.reviewStatus)
  })

type PiMonoFixtureDescriptor = {
  readonly eyebrow: string
  readonly rowFixture: unknown
  readonly summary: string
  readonly title: string
}

const piMonoFixtureCatalog: ReadonlyArray<PiMonoFixtureDescriptor> = [
  {
    eyebrow: "Pi-mono · task-first corpus proof",
    rowFixture: piMonoTaskFirstRowFixture,
    title: "Pi-mono Task-First Runtime Trace",
    summary:
      "Read-only proof over the pi-mono public dataset family, showing task-first branch lineage, compaction evidence, coverage gaps, and the reusable workflow projection."
  },
  {
    eyebrow: "Pi-mono · chat-continuation handoff",
    rowFixture: piMonoChatContinuationRowFixture,
    title: "Pi-mono Chat-Continuation Handoff Trace",
    summary:
      "Read-only proof over the pi-mono public dataset family, showing the same package-owned workflow family on a chat-continuation handoff without app-local shape translation."
  }
]

const buildPiMonoRegistryEntry = (options: PiMonoFixtureDescriptor) =>
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
      entryId: record.recordId,
      eyebrow: options.eyebrow,
      title: options.title,
      summary: options.summary,
      consumerArtifact: ConsumerArtifact.make({
        artifactId: record.session.sessionId,
        artifactKind: "agent-trace",
        sourceKind: "pi-mono",
        sourceLabel: "Pi-mono public dataset",
        sourceUrl: record.source.sourceUrl,
        title: options.title,
        summary: options.summary
      }),
      workflowHookup: WorkflowHookup.make({
        artifactKind: "agent-trace",
        sourceKind: "open-agent-trace",
        transport: registryWorkflowHookupTransport,
        workflowKind: workflowProjection.workflowRecord.workflowKind
      }),
      record,
      workflowProjection
    })
  })

const loadPiMonoFixtureFamily = Effect.all(piMonoFixtureCatalog.map(buildPiMonoRegistryEntry), {
  concurrency: 1
})

const fixtureBackedRegistryFamilies = [loadPiMonoFixtureFamily]

export const loadOpenAgentTraceRegistry = Effect.gen(function*() {
  const registryFamilies = yield* Effect.all(fixtureBackedRegistryFamilies, { concurrency: 1 })
  const registry = registryFamilies.flat()

  return yield* Schema.decodeUnknown(OpenAgentTraceRegistrySchema)(registry)
})
