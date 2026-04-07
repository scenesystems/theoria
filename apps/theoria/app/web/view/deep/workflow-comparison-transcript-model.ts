import { Match } from "effect"
import type { GraphVariant, WorkflowNodeKind } from "effect-inference/Contracts"

import type { CanonicalFrame } from "../../../contracts/canonical-step.js"
import type { EvidenceSection } from "../../../contracts/evidence.js"

import { workflowComparisonEvidenceProjectionFromSections } from "./workflow-comparison-evidence-projection.js"

export type WorkflowComparisonTranscriptEntryViewModel = {
  readonly key: string
  readonly nodeKind: WorkflowNodeKind
  readonly nodeId: string
  readonly prompt: string
  readonly output: string
  readonly rawResponse: string
  readonly totalTokens: string
  readonly durationMs: string
  readonly isCurrent: boolean
  readonly variant: GraphVariant
  readonly variantLabel: string
}

export type WorkflowComparisonTranscriptViewModel = {
  readonly description: string
  readonly entries: ReadonlyArray<WorkflowComparisonTranscriptEntryViewModel>
}

const variantLabel = (variant: GraphVariant): string =>
  Match.value(variant).pipe(
    Match.when("baseline", () => "Baseline"),
    Match.when("optimized", () => "Optimized"),
    Match.exhaustive
  )

const currentEntryKey = (frame: CanonicalFrame | null): string | null =>
  frame !== null && frame.step._tag === "WorkflowComparisonCanonicalStep"
    ? `${frame.step.variant}:${frame.step.nodeId}`
    : null

export const workflowComparisonTranscriptViewModel = ({
  frame,
  sections
}: {
  readonly frame: CanonicalFrame | null
  readonly sections: ReadonlyArray<EvidenceSection>
}): WorkflowComparisonTranscriptViewModel => {
  const activeKey = currentEntryKey(frame)
  const entries = workflowComparisonEvidenceProjectionFromSections(sections).nodeExecutions.map((execution) => ({
    key: `${execution.variant}:${execution.nodeId}`,
    nodeKind: execution.nodeKind,
    nodeId: execution.nodeId,
    prompt: execution.prompt ?? "n/a",
    output: execution.output ?? "n/a",
    rawResponse: execution.rawResponse ?? "n/a",
    totalTokens: execution.totalTokens === null ? "n/a" : `${execution.totalTokens}`,
    durationMs: execution.durationMs === null ? "n/a" : `${execution.durationMs}`,
    isCurrent: `${execution.variant}:${execution.nodeId}` === activeKey,
    variant: execution.variant,
    variantLabel: variantLabel(execution.variant)
  }))

  return {
    description: entries.length === 0
      ? "Transcript evidence appears here once baseline and winner node sections land on the shared ledger."
      : "Every transcript row is projected from package-authored node evidence, not browser-local replay logic.",
    entries
  }
}
