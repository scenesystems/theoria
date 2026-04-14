import { WorkflowStudyRoute } from "../../../../contracts/presentation/path.js"
import type { SurfaceVariant } from "../../../../contracts/presentation/program.js"
import type { WorkflowReference } from "../../../../contracts/study/workflow/revision.js"
import { ActionLink } from "../../primitives/ActionControl.js"
import { surfaceForCard } from "../../primitives/theme/surface.js"

const workflowTheme = surfaceForCard("workflow")

export const OpenWorkflowAction = ({
  label,
  reference,
  variant = "expanded"
}: {
  readonly label: string
  readonly reference: WorkflowReference
  readonly variant?: SurfaceVariant
}) => (
  <ActionLink
    className={workflowTheme.primaryAction}
    href={WorkflowStudyRoute.fromSessionId(reference.seedId).path()}
    label={label}
    variant={variant}
  />
)
