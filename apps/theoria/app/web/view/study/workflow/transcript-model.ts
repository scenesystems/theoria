import { Schema } from "effect"
import { GraphVariantSchema, WorkflowNodeKindSchema } from "effect-inference/Contracts"

import type { CanonicalFrame } from "../../../../contracts/study/workflow/canonical-step.js"
import { workflowTranscriptDescriptions } from "../../../../contracts/study/workflow/evidence.js"
import {
  workflowOptionalNumberText,
  workflowOptionalText,
  workflowTranscriptEntryKey
} from "../../../../contracts/study/workflow/view-presentation.js"

import type { WorkflowEvidenceProjection } from "../../../state/workflow/workflow-evidence.js"

export class WorkflowTranscriptEntryViewModel extends Schema.Class<WorkflowTranscriptEntryViewModel>(
  "WorkflowTranscriptEntryViewModel"
)({
  key: Schema.String,
  nodeKind: WorkflowNodeKindSchema,
  nodeId: Schema.String,
  prompt: Schema.String,
  output: Schema.String,
  rawResponse: Schema.String,
  totalTokens: Schema.String,
  durationMs: Schema.String,
  isCurrent: Schema.Boolean,
  title: Schema.String,
  variant: GraphVariantSchema
}) {}

export class WorkflowTranscriptViewModel extends Schema.Class<WorkflowTranscriptViewModel>(
  "WorkflowTranscriptViewModel"
)({
  description: Schema.String,
  entries: Schema.Array(WorkflowTranscriptEntryViewModel)
}) {
  static project({
    evidence,
    frame
  }: {
    readonly evidence: WorkflowEvidenceProjection
    readonly frame: CanonicalFrame | null
  }): WorkflowTranscriptViewModel {
    const activeKey = currentEntryKey(frame)
    const entries = evidence.nodeExecutions.map((execution) =>
      WorkflowTranscriptEntryViewModel.make({
        key: workflowTranscriptEntryKey({ nodeId: execution.nodeId, variant: execution.variant }),
        nodeKind: execution.nodeKind,
        nodeId: execution.nodeId,
        prompt: workflowOptionalText(execution.prompt),
        output: workflowOptionalText(execution.output),
        rawResponse: workflowOptionalText(execution.rawResponse),
        totalTokens: workflowOptionalNumberText(execution.totalTokens),
        durationMs: workflowOptionalNumberText(execution.durationMs),
        isCurrent: workflowTranscriptEntryKey({ nodeId: execution.nodeId, variant: execution.variant }) === activeKey,
        title: execution.title,
        variant: execution.variant
      })
    )

    return WorkflowTranscriptViewModel.make({
      description: entries.length === 0
        ? workflowTranscriptDescriptions.empty
        : workflowTranscriptDescriptions.present,
      entries
    })
  }
}

const currentEntryKey = (frame: CanonicalFrame | null): string | null =>
  frame !== null && frame.step._tag === "WorkflowCanonicalStep"
    ? workflowTranscriptEntryKey({ nodeId: frame.step.nodeId, variant: frame.step.variant })
    : null
