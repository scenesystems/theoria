import type { OpenAgentTracePanelModel } from "../../../../contracts/study/workflow/open-agent-trace.js"
import { ContentCard } from "../../primitives/ContentCard.js"
import { Stack } from "../../primitives/Layout.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { toneFor } from "../../primitives/theme/tone.js"

import { OpenAgentTracePanelSummaryRows } from "./OpenAgentTracePanelSectionCard.js"

const tone = toneFor("dsp")

export const OpenAgentTracePanelSummaryCard = ({ model }: { readonly model: OpenAgentTracePanelModel }) => (
  <ContentCard className={tone.border} density="standard" shape="left-accent">
    <Stack className="gap-3">
      <SemanticText
        as="h2"
        className="text-ink-900"
        role="section-title"
        text="Open-agent-trace corpus lane"
        variant="expanded"
      />
      <SemanticText
        as="p"
        className="text-ink-700"
        role="card-summary"
        text={model.description}
        variant="expanded"
      />
      <OpenAgentTracePanelSummaryRows rows={model.summaryRows} />
    </Stack>
  </ContentCard>
)
