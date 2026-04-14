import type { OpenAgentTraceEntryPanelModel } from "../../../../contracts/study/workflow/open-agent-trace.js"
import { Layer, Stack } from "../../primitives/Layout.js"
import { SurfaceSubsection } from "../../primitives/SurfaceSubsection.js"

import { renderOpenAgentTracePanelSection } from "./OpenAgentTracePanelSectionCard.js"
import { OpenWorkflowAction } from "./OpenWorkflowAction.js"

export const OpenAgentTracePanelEntry = ({ entry }: { readonly entry: OpenAgentTraceEntryPanelModel }) => (
  <Stack className="gap-6">
    <SurfaceSubsection
      appearance="flush"
      eyebrow={entry.eyebrow}
      summary={entry.summary}
      title={entry.title}
    >
      <OpenWorkflowAction label="Open in workflow" reference={entry.workflowReference} variant="compact" />
    </SurfaceSubsection>

    {entry.groups.map((group) => (
      <Layer className="grid gap-6 md:grid-cols-2" key={group.key}>
        {group.sections.map(renderOpenAgentTracePanelSection)}
      </Layer>
    ))}
  </Stack>
)
