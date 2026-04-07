import { isWorkflowComparisonSurfaceRunPlan } from "../../../contracts/run-plan.js"
import { workflowComparisonOptionForId } from "../../../contracts/workflow/comparison.js"
import { surfaceRunStateAtom } from "../../atoms/surface.js"
import { workflowComparisonDraftRunPlanAtom, workflowComparisonRunPlan } from "../../atoms/workflow-comparison.js"
import { workflowComparisonStreamPath } from "../../services/WorkflowComparisonClient.js"
import { WorkflowComparisonControl } from "../../view/deep/WorkflowComparisonControl.js"
import {
  makeProvingConsumerLaneDescriptor,
  makeServerOnlyStreamingSurfaceRuntime,
  type SurfaceRuntimeSnapshot
} from "../proving-consumer-shared.js"

const workflowComparisonId = "workflow-comparison"
const defaultWorkflowComparisonOption = workflowComparisonOptionForId("workflow-comparison/task-briefing")

const workflowComparisonRunPlanFromSnapshot = (snapshot: SurfaceRuntimeSnapshot) => {
  const runPlan = snapshot.runPlan

  return runPlan !== null && isWorkflowComparisonSurfaceRunPlan(runPlan) ? runPlan : null
}

const workflowComparisonStreamUrl = (
  snapshot: SurfaceRuntimeSnapshot,
  runToken: string | null
): string => {
  const runPlan = workflowComparisonRunPlanFromSnapshot(snapshot)

  return workflowComparisonStreamPath(
    runPlan ?? workflowComparisonRunPlan(defaultWorkflowComparisonOption.id),
    runToken
  )
}

const workflowComparisonProvingConsumerLaneDescriptor = makeProvingConsumerLaneDescriptor({
  consumerId: workflowComparisonId,
  diagnosticsKey: "workflow-comparison/runtime",
  interactiveWidgetKey: "workflow-comparison/control",
  projectionDriverKey: null,
  runtime: makeServerOnlyStreamingSurfaceRuntime({
    snapshot: (registry) => {
      const frozenRunPlan = registry.get(surfaceRunStateAtom(workflowComparisonId)).session.runPlan

      return {
        runPlan: frozenRunPlan !== null && isWorkflowComparisonSurfaceRunPlan(frozenRunPlan)
          ? frozenRunPlan
          : registry.get(workflowComparisonDraftRunPlanAtom),
        localRunPlan: null
      }
    },
    streamUrl: workflowComparisonStreamUrl
  }),
  surface: {
    interactiveWidget: <WorkflowComparisonControl />,
    projectionPlaneHint: {
      stage:
        "Run one frozen workflow comparison at a time and let the browser project canonical graph steps, transcript outputs, and rendered comparisons from the same server-authored stream.",
      evidence:
        "Every workflow-comparison run accumulates graph deltas, node outputs, score changes, and study evidence on one ordered ledger.",
      source:
        `${defaultWorkflowComparisonOption.label} is the default proving route; switch scenarios before running to freeze a different graph comparison.`
    },
    diagnosticsSections: () => []
  }
})

export const provingConsumerLaneDescriptor = workflowComparisonProvingConsumerLaneDescriptor

export { workflowComparisonProvingConsumerLaneDescriptor }
