import { Option, Schema } from "effect"
import {
  type GraphVariant,
  GraphVariantSchema,
  type WorkflowNodeKind,
  WorkflowNodeKindSchema
} from "effect-inference/Contracts"

import type { EvidenceItem, EvidenceSection } from "../../evidence/item.js"
import { workflowEvidenceSectionTitle } from "./evidence-section-title.js"

const workflowEvidenceScope = "workflow"

const isGraphVariant = Schema.is(GraphVariantSchema)
const isWorkflowNodeKind = Schema.is(WorkflowNodeKindSchema)

export const workflowEvidenceSectionKeys = {
  workflowDelta: `${workflowEvidenceScope}/workflow-delta`,
  optimizationStudyEventTrace: `${workflowEvidenceScope}/optimization-study-event-trace`,
  optimizationStudyProgress: `${workflowEvidenceScope}/optimization-study-progress`,
  optimizationStudySummary: `${workflowEvidenceScope}/optimization-study-summary`,
  optimizationSnapshot: `${workflowEvidenceScope}/optimization-snapshot`,
  optimizationWinner: `${workflowEvidenceScope}/optimization-winner`,
  overview: `${workflowEvidenceScope}/overview`,
  variantOverviewPrefix: `${workflowEvidenceScope}/variant-overview`
}

export const workflowEvidenceItemKeys = {
  aggregateScore: `${workflowEvidenceScope}/aggregate-score`,
  bestScore: `${workflowEvidenceScope}/best-score`,
  bestSelection: `${workflowEvidenceScope}/best-selection`,
  completedTrials: `${workflowEvidenceScope}/completed-trials`,
  currentScore: `${workflowEvidenceScope}/current-score`,
  currentSelection: `${workflowEvidenceScope}/current-selection`,
  graphNodes: `${workflowEvidenceScope}/graph-nodes`,
  output: `${workflowEvidenceScope}/output`,
  prompt: `${workflowEvidenceScope}/prompt`,
  rawResponse: `${workflowEvidenceScope}/raw-response`,
  recoveredOrImprovedAuthoredOptimized: `${workflowEvidenceScope}/recovered-or-improved-authored-optimized`,
  selectedKnobs: `${workflowEvidenceScope}/selected-knobs`,
  snapshotFacts: `${workflowEvidenceScope}/snapshot-facts`,
  snapshotJson: `${workflowEvidenceScope}/snapshot-json`,
  studyEvents: `${workflowEvidenceScope}/study-events`,
  totalTokens: `${workflowEvidenceScope}/total-tokens`,
  traceDuration: `${workflowEvidenceScope}/trace-duration-ms`,
  traversal: `${workflowEvidenceScope}/traversal`,
  traversalSteps: `${workflowEvidenceScope}/traversal-steps`,
  trialBudget: `${workflowEvidenceScope}/trial-budget`,
  winnerRecord: `${workflowEvidenceScope}/winner-record`,
  winnerTraversal: `${workflowEvidenceScope}/winner-traversal`,
  winnerVsAuthoredOptimizedNodeCount: `${workflowEvidenceScope}/winner-vs-authored-optimized-node-count`,
  winnerVsAuthoredOptimizedScore: `${workflowEvidenceScope}/winner-vs-authored-optimized-score`
}

export {
  workflowEvidenceItemLabels,
  workflowEvidenceSectionTitles,
  workflowEvidenceTableColumns,
  workflowGraphVariantLabel,
  workflowNodeExecutionLatencyMs,
  workflowNodeExecutionTotalTokens,
  workflowOptimizationSnapshotFacts,
  workflowRuntimeEvidenceFieldLabels,
  workflowRuntimeEvidenceRows,
  workflowTableDetailRows,
  workflowTranscriptDescriptions
} from "./evidence-presentation.js"

export const workflowNodeExecutionSectionPrefix = `${workflowEvidenceScope}/node-execution`

export type WorkflowNodeExecutionSectionDescriptor = {
  readonly key: string
  readonly nodeId: string
  readonly nodeKind: WorkflowNodeKind
  readonly variant: GraphVariant
}

export type WorkflowEvidenceSectionDescriptor =
  | { readonly family: "overview"; readonly key: string; readonly meaning: "overview" }
  | { readonly family: "graph"; readonly key: string; readonly meaning: "workflow-delta" }
  | {
    readonly family: "graph"
    readonly key: string
    readonly meaning: "variant-overview"
    readonly variant: GraphVariant
  }
  | {
    readonly family: "optimization"
    readonly key: string
    readonly meaning:
      | "optimization-study-event-trace"
      | "optimization-study-progress"
      | "optimization-study-summary"
      | "optimization-snapshot"
      | "optimization-winner"
  }
  | ({ readonly family: "node-execution"; readonly meaning: "node-execution" } & WorkflowNodeExecutionSectionDescriptor)

type WorkflowEvidenceSectionFamily = WorkflowEvidenceSectionDescriptor["family"]

export type WorkflowEvidenceSectionMatch<Family extends WorkflowEvidenceSectionFamily = WorkflowEvidenceSectionFamily> =
  {
    readonly descriptor: Extract<WorkflowEvidenceSectionDescriptor, { readonly family: Family }>
    readonly section: EvidenceSection
  }

export const workflowVariantOverviewSectionKey = (variant: GraphVariant): string =>
  `${workflowEvidenceSectionKeys.variantOverviewPrefix}/${variant}`

export const workflowNodeExecutionSectionKey = ({
  nodeId,
  nodeKind,
  variant
}: {
  readonly nodeId: string
  readonly nodeKind: WorkflowNodeKind
  readonly variant: GraphVariant
}): string => `${workflowNodeExecutionSectionPrefix}/${variant}/${nodeId}/${nodeKind}`

export const parseWorkflowNodeExecutionSectionKey = (
  key: Option.Option<string>
): WorkflowNodeExecutionSectionDescriptor | null =>
  key.pipe(
    Option.flatMap((value) => {
      const [scope, kind, variant, nodeId, nodeKind] = value.split("/")
      const isNodeExecutionSection = scope === workflowEvidenceScope
        && kind === "node-execution"
        && isGraphVariant(variant)

      return isNodeExecutionSection
        ? Option.all({
          nodeId: Option.fromNullable(nodeId),
          nodeKind: Option.fromNullable(nodeKind)
        }).pipe(
          Option.flatMap(({ nodeId, nodeKind }) =>
            isWorkflowNodeKind(nodeKind)
              ? Option.some({ key: value, nodeId, nodeKind, variant })
              : Option.none()
          )
        )
        : Option.none()
    }),
    Option.match({
      onNone: () => null,
      onSome: (descriptor) => descriptor
    })
  )

const workflowVariantOverviewDescriptor = (value: string): WorkflowEvidenceSectionDescriptor | null =>
  Option.fromNullable(value.slice(`${workflowEvidenceSectionKeys.variantOverviewPrefix}/`.length)).pipe(
    Option.filter(isGraphVariant),
    Option.match({
      onNone: () => null,
      onSome: (variant) => ({ family: "graph", key: value, meaning: "variant-overview", variant })
    })
  )

export const workflowEvidenceSectionDescriptor = (
  key: Option.Option<string>
): WorkflowEvidenceSectionDescriptor | null =>
  key.pipe(
    Option.match({
      onNone: () => null,
      onSome: (value) => {
        const nodeExecution = parseWorkflowNodeExecutionSectionKey(Option.some(value))

        return nodeExecution !== null
          ? { family: "node-execution", meaning: "node-execution", ...nodeExecution }
          : value === workflowEvidenceSectionKeys.overview
          ? { family: "overview", key: value, meaning: "overview" }
          : value === workflowEvidenceSectionKeys.workflowDelta
          ? { family: "graph", key: value, meaning: "workflow-delta" }
          : value.startsWith(`${workflowEvidenceSectionKeys.variantOverviewPrefix}/`)
          ? workflowVariantOverviewDescriptor(value)
          : value === workflowEvidenceSectionKeys.optimizationStudyEventTrace
          ? { family: "optimization", key: value, meaning: "optimization-study-event-trace" }
          : value === workflowEvidenceSectionKeys.optimizationStudyProgress
          ? { family: "optimization", key: value, meaning: "optimization-study-progress" }
          : value === workflowEvidenceSectionKeys.optimizationStudySummary
          ? { family: "optimization", key: value, meaning: "optimization-study-summary" }
          : value === workflowEvidenceSectionKeys.optimizationSnapshot
          ? { family: "optimization", key: value, meaning: "optimization-snapshot" }
          : value === workflowEvidenceSectionKeys.optimizationWinner
          ? { family: "optimization", key: value, meaning: "optimization-winner" }
          : null
      }
    })
  )

export const workflowEvidenceSectionTitleForKey = (key: Option.Option<string>): string | null =>
  Option.fromNullable(workflowEvidenceSectionDescriptor(key)).pipe(
    Option.match({
      onNone: () => null,
      onSome: workflowEvidenceSectionTitle
    })
  )

export const workflowEvidenceSectionTitleForSectionKey = (key: string): string =>
  workflowEvidenceSectionTitleForKey(Option.some(key)) ?? key

export const workflowVariantOverviewSectionTitle = (variant: GraphVariant): string =>
  workflowEvidenceSectionTitleForSectionKey(workflowVariantOverviewSectionKey(variant))

export const workflowNodeExecutionSectionTitle = ({
  nodeId,
  nodeKind,
  variant
}: {
  readonly nodeId: string
  readonly nodeKind: WorkflowNodeKind
  readonly variant: GraphVariant
}): string =>
  workflowEvidenceSectionTitleForSectionKey(
    workflowNodeExecutionSectionKey({ nodeId, nodeKind, variant })
  )

const workflowEvidenceSectionOrder = (descriptor: WorkflowEvidenceSectionDescriptor): number =>
  descriptor.meaning === "overview"
    ? 0
    : descriptor.meaning === "workflow-delta"
    ? 10
    : descriptor.meaning === "variant-overview"
    ? descriptor.variant === "baseline"
      ? 20
      : 30
    : descriptor.meaning === "optimization-study-progress"
    ? 40
    : descriptor.meaning === "optimization-study-summary"
    ? 50
    : descriptor.meaning === "optimization-winner"
    ? 60
    : descriptor.meaning === "optimization-snapshot"
    ? 70
    : descriptor.meaning === "optimization-study-event-trace"
    ? 80
    : descriptor.meaning === "node-execution"
    ? descriptor.variant === "baseline"
      ? 90
      : 100
    : 110

const workflowEvidenceSectionIsFamily = <Family extends WorkflowEvidenceSectionFamily>(
  descriptor: WorkflowEvidenceSectionDescriptor,
  family: Family
): descriptor is Extract<WorkflowEvidenceSectionDescriptor, { readonly family: Family }> => descriptor.family === family

export const workflowEvidenceSectionsForFamily = <Family extends WorkflowEvidenceSectionFamily>({
  family,
  sections
}: {
  readonly family: Family
  readonly sections: ReadonlyArray<EvidenceSection>
}): ReadonlyArray<WorkflowEvidenceSectionMatch<Family>> =>
  sections
    .flatMap((section, originalIndex) => {
      const descriptor = workflowEvidenceSectionDescriptor(Option.fromNullable(section.key))

      return descriptor === null || !workflowEvidenceSectionIsFamily(descriptor, family)
        ? []
        : [{ descriptor, originalIndex, section }]
    })
    .sort((left, right) =>
      workflowEvidenceSectionOrder(left.descriptor) - workflowEvidenceSectionOrder(right.descriptor)
      || left.originalIndex - right.originalIndex
    )
    .map(({ originalIndex: _originalIndex, ...match }) => match)

type WorkflowEvidenceItemTag = EvidenceItem["_tag"]

type WorkflowNumericComparisonValue = {
  readonly baseline: number | null
  readonly improved: number | null
}

const workflowItemByKey = <Tag extends WorkflowEvidenceItemTag>({
  key,
  section,
  tag
}: {
  readonly key: string
  readonly section: EvidenceSection | null
  readonly tag: Tag
}): Extract<EvidenceItem, { readonly _tag: Tag }> | null =>
  section?.items.find(
    (item): item is Extract<EvidenceItem, { readonly _tag: Tag }> => item._tag === tag && item.key === key
  ) ?? null

export const workflowTextValueByKey = (section: EvidenceSection | null, key: string): string | null =>
  workflowItemByKey({ key, section, tag: "Text" })?.value ?? null

export const workflowScalarValueByKey = (section: EvidenceSection | null, key: string): number | null =>
  workflowItemByKey({ key, section, tag: "Scalar" })?.value ?? null

export const workflowNumericComparisonValueByKey = (
  section: EvidenceSection | null,
  key: string
): WorkflowNumericComparisonValue => {
  const comparison = workflowItemByKey({ key, section, tag: "Comparison" })

  return {
    baseline: comparison?.baseline ?? null,
    improved: comparison?.improved ?? null
  }
}

export const workflowTableRowsByKey = (
  section: EvidenceSection | null,
  key: string
): ReadonlyArray<ReadonlyArray<string>> => workflowItemByKey({ key, section, tag: "Table" })?.rows ?? []

export const workflowLeadingTextRows = (rows: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<string> =>
  rows.flatMap((row) =>
    Option.fromNullable(row[0]).pipe(
      Option.match({
        onNone: () => [],
        onSome: (value) => [value]
      })
    )
  )

export const workflowStringPairRows = (
  rows: ReadonlyArray<ReadonlyArray<string>>
): ReadonlyArray<[string, string]> =>
  rows.flatMap((row) =>
    Option.all({
      choice: Option.fromNullable(row[1]),
      knob: Option.fromNullable(row[0])
    }).pipe(
      Option.match({
        onNone: () => [],
        onSome: ({ choice, knob }) => [[knob, choice]]
      })
    )
  )

export const workflowStringTripleRows = (
  rows: ReadonlyArray<ReadonlyArray<string>>
): ReadonlyArray<[string, string, string]> =>
  rows.flatMap((row) =>
    Option.all({
      detail: Option.fromNullable(row[2]),
      event: Option.fromNullable(row[1]),
      index: Option.fromNullable(row[0])
    }).pipe(
      Option.match({
        onNone: () => [],
        onSome: ({ detail, event, index }) => [[index, event, detail]]
      })
    )
  )
