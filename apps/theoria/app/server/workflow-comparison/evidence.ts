import { Match, Option } from "effect"
import type { WorkflowStateLane } from "effect-inference/Contracts"

import { Highlight, StageAdvance, StageEnter, StageExit } from "../../contracts/choreography.js"
import {
  applyEvidenceEventToStore,
  evidenceSectionsFromStore,
  type EvidenceStoreState
} from "../../contracts/evidence-store.js"
import { canonicalStepEvent, Choreography, type EvidenceEvent, SectionAppend } from "../../contracts/evidence-stream.js"
import type { EvidenceSection } from "../../contracts/evidence.js"
import type { Program } from "../../contracts/presentation.js"
import type { RunData } from "../../contracts/run.js"
import {
  workflowComparisonEvidenceItemKeys,
  workflowComparisonEvidenceSectionKeys,
  workflowComparisonNodeExecutionSectionKey,
  workflowComparisonVariantOverviewSectionKey
} from "../../contracts/workflow/comparison-evidence-keys.js"
import type { WorkflowComparisonNodeExecution } from "../../contracts/workflow/comparison-run.js"
import type { WorkflowComparisonVariantExecution } from "../../contracts/workflow/comparison-run.js"
import { WorkflowComparisonCanonicalStep } from "../../contracts/workflow/comparison-step.js"
import type { FrozenWorkflowComparisonRun } from "./frozen.js"

type WorkflowComparisonVariantOverview = {
  readonly variant: WorkflowComparisonVariantExecution["variant"]
  readonly record: WorkflowComparisonVariantExecution["record"]
  readonly graphProjection: WorkflowComparisonVariantExecution["graphProjection"]
}

const variantLabel = (variant: WorkflowComparisonNodeExecution["variant"]): string =>
  Match.value(variant).pipe(
    Match.when("baseline", () => "Baseline"),
    Match.when("optimized", () => "Optimized"),
    Match.exhaustive
  )

const optionalValue = (value: Option.Option<string | number>): string =>
  value.pipe(
    Option.match({
      onNone: () => "n/a",
      onSome: (resolved) => `${resolved}`
    })
  )

const workflowOverviewSection = (comparison: FrozenWorkflowComparisonRun): EvidenceSection => ({
  key: workflowComparisonEvidenceSectionKeys.overview,
  title: "Workflow Comparison Overview",
  items: [
    { _tag: "Text", label: "Workflow", value: comparison.label },
    { _tag: "Text", label: "Summary", value: comparison.summary },
    {
      _tag: "Comparison",
      label: "Graph Nodes",
      baseline: comparison.baseline.record.graph.nodes.length,
      improved: comparison.optimized.record.graph.nodes.length,
      unit: "count",
      direction: "higher-is-better"
    }
  ]
})

const variantOverviewSection = (execution: WorkflowComparisonVariantOverview): EvidenceSection => ({
  key: workflowComparisonVariantOverviewSectionKey(execution.variant),
  title: `${variantLabel(execution.variant)} Graph`,
  items: [
    {
      _tag: "Table",
      key: workflowComparisonEvidenceItemKeys.traversal,
      label: "Traversal",
      columns: ["Node", "Kind", "Role"],
      rows: execution.graphProjection.traversal.map((nodeId) => {
        const node = execution.record.graph.nodes.find((entry) => entry.nodeId === nodeId)

        return [nodeId, node?.nodeKind ?? "unknown", node?.runtimeRole ?? "unknown"]
      })
    },
    {
      _tag: "Scalar",
      key: workflowComparisonEvidenceItemKeys.traversalSteps,
      label: "Traversal Steps",
      value: execution.graphProjection.traversal.length,
      unit: "steps",
      format: "integer"
    }
  ]
})

const nodeExecutionSection = (execution: WorkflowComparisonNodeExecution): EvidenceSection => ({
  key: workflowComparisonNodeExecutionSectionKey({
    nodeId: execution.node.nodeId,
    nodeKind: execution.node.nodeKind,
    variant: execution.variant
  }),
  title: `${variantLabel(execution.variant)} · ${execution.node.nodeId}`,
  items: [
    { _tag: "Text", key: workflowComparisonEvidenceItemKeys.output, label: "Output", value: execution.outputText },
    { _tag: "Text", key: workflowComparisonEvidenceItemKeys.prompt, label: "Prompt", value: execution.trace.prompt },
    {
      _tag: "Text",
      key: workflowComparisonEvidenceItemKeys.rawResponse,
      label: "Raw response",
      value: execution.trace.rawResponse
    },
    {
      _tag: "Scalar",
      key: workflowComparisonEvidenceItemKeys.traceDuration,
      label: "Trace duration",
      value: execution.trace.durationMs,
      unit: "ms",
      format: "fixed"
    },
    {
      _tag: "Scalar",
      key: workflowComparisonEvidenceItemKeys.totalTokens,
      label: "Total tokens",
      value: execution.runtimeEvidence.resolvedRuntime.usage?.totalTokens ?? execution.trace.totalTokens,
      unit: "tokens",
      format: "integer"
    },
    {
      _tag: "Table",
      label: "Runtime Evidence",
      columns: ["Field", "Value"],
      rows: [
        ["Requested model", execution.runtimeEvidence.desired.artifact.modelRef],
        ["Route family", execution.runtimeEvidence.resolvedRoute.route.family],
        ["Serve mode", execution.runtimeEvidence.resolvedRoute.route.serveMode],
        [
          "Selected provider",
          optionalValue(Option.fromNullable(execution.runtimeEvidence.resolvedRoute.selectedProvider))
        ],
        ["Response model", execution.runtimeEvidence.resolvedRuntime.responseModel],
        ["Response id", optionalValue(Option.fromNullable(execution.runtimeEvidence.resolvedRuntime.responseId))],
        [
          "Started at",
          optionalValue(Option.fromNullable(execution.runtimeEvidence.resolvedRuntime.startedAtMs))
        ],
        [
          "Completed at",
          optionalValue(Option.fromNullable(execution.runtimeEvidence.resolvedRuntime.completedAtMs))
        ]
      ]
    }
  ]
})

const comparisonDeltaSection = (
  baseline: WorkflowComparisonVariantExecution,
  optimized: WorkflowComparisonVariantExecution
): EvidenceSection => ({
  key: workflowComparisonEvidenceSectionKeys.comparisonDelta,
  title: "Comparison Delta",
  items: [
    {
      _tag: "Comparison",
      key: workflowComparisonEvidenceItemKeys.aggregateScore,
      label: "Aggregate Score",
      baseline: baseline.report.aggregateScore,
      improved: optimized.report.aggregateScore,
      unit: "score",
      direction: "higher-is-better"
    },
    {
      _tag: "Comparison",
      key: workflowComparisonEvidenceItemKeys.graphNodes,
      label: "Graph Nodes",
      baseline: baseline.record.graph.nodes.length,
      improved: optimized.record.graph.nodes.length,
      unit: "count",
      direction: "higher-is-better"
    }
  ]
})

export const overviewEventsForComparison = (comparison: FrozenWorkflowComparisonRun): ReadonlyArray<EvidenceEvent> => [
  new SectionAppend({ section: workflowOverviewSection(comparison) })
]

export const variantStartEvents = (
  execution: WorkflowComparisonVariantOverview
): ReadonlyArray<EvidenceEvent> => [
  new Choreography({
    cue: new StageEnter({
      stageId: execution.variant,
      params: { stepCount: execution.graphProjection.traversal.length }
    })
  }),
  new SectionAppend({ section: variantOverviewSection(execution) })
]

export const nodeExecutionEvents = ({
  activeStateLanes,
  aggregateScore,
  comparisonId,
  execution,
  workflowKind
}: {
  readonly activeStateLanes: ReadonlyArray<WorkflowStateLane>
  readonly aggregateScore: number
  readonly comparisonId: FrozenWorkflowComparisonRun["comparisonId"]
  readonly execution: WorkflowComparisonNodeExecution
  readonly workflowKind: FrozenWorkflowComparisonRun["workflowKind"]
}): ReadonlyArray<EvidenceEvent> => [
  new Choreography({ cue: new StageAdvance({ stageId: execution.variant, step: execution.stepIndex - 1 }) }),
  canonicalStepEvent(
    new WorkflowComparisonCanonicalStep({
      comparisonId,
      workflowKind,
      variant: execution.variant,
      nodeId: execution.node.nodeId,
      nodeKind: execution.node.nodeKind,
      runtimeRole: execution.node.runtimeRole,
      stepIndex: execution.stepIndex,
      stepCount: execution.stepCount,
      lineage: execution.lineage,
      activeStateLanes,
      outputText: execution.outputText,
      aggregateScore
    })
  ),
  new SectionAppend({ section: nodeExecutionSection(execution) })
]

export const variantEndEvents = (variant: WorkflowComparisonNodeExecution["variant"]): ReadonlyArray<EvidenceEvent> => [
  new Choreography({ cue: new StageExit({ stageId: variant }) })
]

export const comparisonSummaryEvents = (
  baseline: WorkflowComparisonVariantExecution,
  optimized: WorkflowComparisonVariantExecution
): ReadonlyArray<EvidenceEvent> => [
  new Choreography({ cue: new StageEnter({ stageId: "comparison" }) }),
  new SectionAppend({ section: comparisonDeltaSection(baseline, optimized) }),
  new Choreography({ cue: new Highlight({ target: "workflow-comparison-winner", params: { variant: "optimized" } }) }),
  new Choreography({ cue: new StageExit({ stageId: "comparison" }) })
]

export const runDataFromStore = ({
  comparison,
  durationMs,
  program,
  store
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly durationMs: number
  readonly program: Program
  readonly store: EvidenceStoreState
}): RunData => ({
  id: comparison.consumerId,
  packageName: "@theoria/theoria-app",
  summary: comparison.summary,
  durationMs,
  program,
  sections: evidenceSectionsFromStore(store)
})

export const applyEventsToStore = (
  store: EvidenceStoreState,
  events: ReadonlyArray<EvidenceEvent>
): EvidenceStoreState => events.reduce(applyEvidenceEventToStore, store)
