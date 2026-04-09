import { ProjectionPlaneHint } from "../../../contracts/presentation/surface-runtime-hints.js"
import { defaultWorkflowScenarioId, workflowScenarioOptionForId } from "../../../contracts/study/workflow/scenario.js"
import { WorkflowControl } from "../../view/study/workflow/WorkflowControl.js"
import { SurfaceViewExtension } from "../kernel/descriptor.js"

const defaultWorkflowOption = workflowScenarioOptionForId(defaultWorkflowScenarioId)

const workflowProjectionPlaneHint = ProjectionPlaneHint.make({
  stage:
    "Run one frozen workflow study at a time and let the browser project canonical graph steps, transcript outputs, and rendered replays from the same server-authored stream.",
  evidence:
    "Every workflow run accumulates graph deltas, node outputs, score changes, and study evidence on one ordered ledger.",
  source:
    `${defaultWorkflowOption.label} is the default proving route; switch scenarios before running to freeze a different workflow replay.`
})

export const workflowSurfaceViewExtension = SurfaceViewExtension.make({
  interactiveWidget: <WorkflowControl />,
  projectionPlaneHint: workflowProjectionPlaneHint,
  diagnosticsSections: () => []
})
