import { Option, Schema } from "effect"
import type { GraphVariant } from "effect-inference/Contracts"

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
