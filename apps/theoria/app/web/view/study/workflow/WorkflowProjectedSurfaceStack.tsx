import type { SurfaceVariant } from "../../../../contracts/presentation/program.js"
import { SurfacePlaneFrame } from "../../primitives/SurfacePlaneFrame.js"
import type { Surface } from "../../primitives/theme/surface.js"
import { OpenAgentTracePanel } from "../open-agent-trace/OpenAgentTracePanel.js"

import { WorkflowControl } from "./WorkflowControl.js"

export const WorkflowProjectedSurfaceStack = ({
  hintText,
  interactiveLabel,
  theme,
  variant
}: {
  readonly hintText: string
  readonly interactiveLabel: string | null
  readonly theme: Surface
  readonly variant: SurfaceVariant
}) => (
  <>
    <SurfacePlaneFrame
      className={theme.panel}
      summaryText={hintText}
      title={interactiveLabel ?? "Study"}
      variant={variant}
    >
      <WorkflowControl />
    </SurfacePlaneFrame>

    <SurfacePlaneFrame
      className={theme.panel}
      summaryText="Ordered interaction turns, tool actions, and runtime follow-up projected as one study-native surface."
      title="Interaction"
      variant={variant}
    >
      <OpenAgentTracePanel />
    </SurfacePlaneFrame>
  </>
)
