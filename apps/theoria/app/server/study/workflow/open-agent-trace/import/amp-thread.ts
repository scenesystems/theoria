import { Effect } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { ConsumerArtifact } from "../../../../../contracts/study/workflow/consumer-artifact.js"
import {
  AmpThreadImportPayload,
  type AmpThreadImportRequest,
  canonicalizeAmpThreadImportRequest,
  OpenAgentTraceRegistryEntry
} from "../../../../../contracts/study/workflow/open-agent-trace.js"
import {
  importWorkflowHookupTransport,
  WorkflowHookup
} from "../../../../../contracts/study/workflow/workflow-hookup.js"
import { AmpThreadImportKernel } from "../../../../kernel/amp-thread-import/service.js"

const publishedRecord = (record: typeof Experimental.OpenAgentTrace.Record.Type) =>
  Experimental.OpenAgentTrace.Record.make({
    ...record,
    reviewStatus: Experimental.OpenAgentTrace.publishedReviewStatus(record.reviewStatus)
  })

const importedTitle = (request: AmpThreadImportRequest, title: string): string => {
  const trimmed = title.trim()

  return trimmed.length > 0 ? trimmed : `Amp Thread ${request.threadId}`
}

const importedSummary = (options: {
  readonly coverageGapCount: number
  readonly messageCount: number
}) =>
  `Imported from the local Amp CLI as evidentiary thread replay with ${String(options.messageCount)} messages and ${
    String(options.coverageGapCount)
  } explicit coverage gaps.`

export const importAmpThread = (request: AmpThreadImportRequest) =>
  Effect.gen(function*() {
    const canonicalRequest = canonicalizeAmpThreadImportRequest(request)
    const kernel = yield* AmpThreadImportKernel
    const snapshot = yield* kernel.exportSnapshot(canonicalRequest)
    const normalized = yield* Experimental.OpenAgentTrace.AmpThread.normalizeExportSnapshot({
      snapshot,
      sourceUrl: canonicalRequest.sourceUrl
    })
    const record = publishedRecord(normalized.record)
    const workflowProjection = yield* Experimental.OpenAgentTrace.WorkflowProjection.project(record)
    const title = importedTitle(canonicalRequest, snapshot.title)
    const summary = importedSummary({
      coverageGapCount: workflowProjection.coverageGaps.length,
      messageCount: snapshot.messages.length
    })
    const registryEntry = OpenAgentTraceRegistryEntry.make({
      entryId: record.recordId,
      eyebrow: "Amp thread · local CLI import",
      title,
      summary,
      consumerArtifact: ConsumerArtifact.make({
        artifactId: canonicalRequest.threadId,
        artifactKind: "agent-trace",
        sourceKind: "amp-thread",
        sourceLabel: `Amp thread ${canonicalRequest.threadId}`,
        sourceUrl: canonicalRequest.sourceUrl,
        title,
        summary
      }),
      workflowHookup: WorkflowHookup.make({
        artifactKind: "agent-trace",
        sourceKind: "open-agent-trace",
        transport: importWorkflowHookupTransport,
        workflowKind: workflowProjection.workflowRecord.workflowKind
      }),
      record,
      workflowProjection
    })

    return AmpThreadImportPayload.single(registryEntry)
  })
