import type { OpenAgentTracePanelModel } from "../../../../contracts/study/workflow/open-agent-trace.js"
import { Stack } from "../../primitives/Layout.js"
import { SurfaceSubsection } from "../../primitives/SurfaceSubsection.js"

import { OpenAgentTracePanelSummaryRows } from "./OpenAgentTracePanelSectionCard.js"

export const OpenAgentTracePanelSummaryCard = ({ model }: { readonly model: OpenAgentTracePanelModel }) => (
  <SurfaceSubsection appearance="flush" summary={model.description} title="Open-agent-trace corpus lane">
    <Stack className="gap-3">
      <OpenAgentTracePanelSummaryRows rows={model.summaryRows} />
    </Stack>
  </SurfaceSubsection>
)
