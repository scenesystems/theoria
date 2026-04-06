import { type WorkflowComparisonId, workflowComparisonOptionForId } from "../../../contracts/workflow/comparison.js"
import { workflowComparisonRunPlan, workflowComparisonSelectionAtom } from "../../atoms/workflow-comparison.js"
import { makeProvingConsumerLaneDescriptor, makeServerOnlyStreamingSurfaceRuntime } from "../proving-consumer-shared.js"

const workflowComparisonId = "workflow-comparison"
const defaultWorkflowComparisonOption = workflowComparisonOptionForId("workflow-comparison/task-briefing")

const workflowComparisonStreamUrl = (
  snapshot: {
    readonly runPlan:
      | {
        readonly consumerId: "workflow-comparison"
        readonly comparisonId: WorkflowComparisonId
        readonly lane: "deterministic-fallback"
      }
      | null
  },
  runToken: string | null
): string => {
  const params = new URLSearchParams()

  if (snapshot.runPlan !== null) {
    params.set("comparisonId", snapshot.runPlan.comparisonId)
    params.set("lane", snapshot.runPlan.lane)
  }

  if (runToken !== null && runToken.trim().length > 0) {
    params.set("runToken", runToken.trim())
  }

  return `/api/workflow-comparison/stream?${params.toString()}`
}

export const workflowComparisonProvingConsumerLaneDescriptor = makeProvingConsumerLaneDescriptor({
  consumerId: workflowComparisonId,
  diagnosticsKey: "workflow-comparison/runtime",
  interactiveWidgetKey: null,
  projectionDriverKey: null,
  runtime: makeServerOnlyStreamingSurfaceRuntime({
    snapshot: (registry) => {
      const comparisonId = registry.get(workflowComparisonSelectionAtom)

      return {
        runPlan: workflowComparisonRunPlan(comparisonId),
        localRunPlan: null
      }
    },
    streamUrl: workflowComparisonStreamUrl
  }),
  surface: {
    interactiveWidget: null,
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
