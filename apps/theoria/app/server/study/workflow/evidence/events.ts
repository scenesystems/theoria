import type { WorkflowStateLane } from "effect-inference/Contracts"

import {
  canonicalStepEvent,
  Choreography,
  type EvidenceEvent,
  SectionAppend
} from "../../../../contracts/evidence/stream.js"
import { Highlight, StageAdvance, StageEnter, StageExit } from "../../../../contracts/study/workflow/choreography.js"
import type { WorkflowNodeExecution } from "../../../../contracts/study/workflow/execution.js"
import type { WorkflowVariantExecution } from "../../../../contracts/study/workflow/execution.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import { WorkflowCanonicalStep } from "../../../../contracts/study/workflow/step.js"
import {
  nodeExecutionSection,
  variantOverviewSection,
  workflowDeltaSection,
  workflowOverviewSection,
  type WorkflowVariantOverview
} from "./sections.js"

export const workflowOverviewEvents = (workflowRun: FrozenWorkflowRun): ReadonlyArray<EvidenceEvent> => [
  new SectionAppend({ section: workflowOverviewSection(workflowRun) })
]

export const variantStartEvents = (
  execution: WorkflowVariantOverview
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
  seedId,
  execution,
  workflowKind
}: {
  readonly activeStateLanes: ReadonlyArray<WorkflowStateLane>
  readonly aggregateScore: number
  readonly seedId: FrozenWorkflowRun["seedId"]
  readonly execution: WorkflowNodeExecution
  readonly workflowKind: FrozenWorkflowRun["workflowKind"]
}): ReadonlyArray<EvidenceEvent> => [
  new Choreography({ cue: new StageAdvance({ stageId: execution.variant, step: execution.stepIndex - 1 }) }),
  canonicalStepEvent(
    new WorkflowCanonicalStep({
      seedId,
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

export const variantEndEvents = (variant: WorkflowNodeExecution["variant"]): ReadonlyArray<EvidenceEvent> => [
  new Choreography({ cue: new StageExit({ stageId: variant }) })
]

export const workflowDeltaEvents = (
  baseline: WorkflowVariantExecution,
  optimized: WorkflowVariantExecution
): ReadonlyArray<EvidenceEvent> => [
  new Choreography({ cue: new StageEnter({ stageId: "workflow-delta" }) }),
  new SectionAppend({ section: workflowDeltaSection(baseline, optimized) }),
  new Choreography({ cue: new Highlight({ target: "workflow-winner", params: { variant: "optimized" } }) }),
  new Choreography({ cue: new StageExit({ stageId: "workflow-delta" }) })
]
