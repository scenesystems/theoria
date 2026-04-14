import { Option, Schema } from "effect"
import { type GraphVariant, GraphVariantSchema, WorkflowNodeKindSchema } from "effect-inference/Contracts"

import type { CanonicalFrame } from "./canonical-step.js"

export const WorkflowGraphCardKeySchema = Schema.Literal("baseline", "authored-optimized", "search-winner")

export type WorkflowGraphCardKey = typeof WorkflowGraphCardKeySchema.Type

export const WorkflowRenderedPreviewPaneKeySchema = Schema.Literal("baseline", "replay-target")

export type WorkflowRenderedPreviewPaneKey = typeof WorkflowRenderedPreviewPaneKeySchema.Type

export const workflowOptionalText = (value: string | null): string =>
  Option.getOrElse(Option.fromNullable(value), () => "n/a")

export const workflowOptionalNumberText = (value: number | null): string => value === null ? "n/a" : `${value}`

export const workflowFixedNumberText = ({
  digits,
  value
}: {
  readonly digits: number
  readonly value: number | null
}): string => (value === null ? "n/a" : value.toFixed(digits))

export const workflowDeltaText = ({
  baseline,
  digits,
  improved
}: {
  readonly baseline: number | null
  readonly digits: number
  readonly improved: number | null
}): string =>
  baseline === null || improved === null
    ? "n/a"
    : `${improved >= baseline ? "+" : ""}${(improved - baseline).toFixed(digits)}`

export const workflowTraversalText = ({
  fallback,
  nodes
}: {
  readonly fallback: string
  readonly nodes: ReadonlyArray<string>
}): string => (nodes.length === 0 ? fallback : nodes.join(" -> "))

export const workflowTranscriptEntryKey = ({
  nodeId,
  variant
}: {
  readonly nodeId: string
  readonly variant: GraphVariant
}): string => `${variant}:${nodeId}`

type WorkflowTranscriptEvidenceEntry = {
  readonly durationMs: number | null
  readonly nodeId: string
  readonly nodeKind: typeof WorkflowNodeKindSchema.Type
  readonly output: string | null
  readonly prompt: string | null
  readonly rawResponse: string | null
  readonly title: string
  readonly totalTokens: number | null
  readonly variant: GraphVariant
}

export type WorkflowTranscriptEvidenceProjection = {
  readonly nodeExecutions: ReadonlyArray<WorkflowTranscriptEvidenceEntry>
}

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
  static emptyDescription(): string {
    return "Transcript evidence will appear here once the study starts reaching workflow nodes."
  }

  static presentDescription(): string {
    return "Read the prompts, outputs, and response data that explain how each workflow step behaved."
  }

  static project({
    evidence,
    frame
  }: {
    readonly evidence: WorkflowTranscriptEvidenceProjection
    readonly frame: CanonicalFrame | null
  }): WorkflowTranscriptViewModel {
    const activeKey = frame !== null && frame.step._tag === "WorkflowCanonicalStep"
      ? workflowTranscriptEntryKey({ nodeId: frame.step.nodeId, variant: frame.step.variant })
      : null
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
        ? WorkflowTranscriptViewModel.emptyDescription()
        : WorkflowTranscriptViewModel.presentDescription(),
      entries
    })
  }
}
