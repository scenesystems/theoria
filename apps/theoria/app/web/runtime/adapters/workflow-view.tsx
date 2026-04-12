import { WorkflowControl } from "../../view/study/workflow/WorkflowControl.js"
import { SurfaceViewExtension } from "../kernel/surface-view-extension.js"

export const workflowSurfaceViewExtension = SurfaceViewExtension.make({
  interactiveWidget: <WorkflowControl />,
  diagnosticsSections: () => []
})
