import { ContentCard } from "../../primitives/ContentCard.js"
import { Cluster, Stack } from "../../primitives/Layout.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { toneFor } from "../../primitives/theme/tone.js"

import { renderOpenAgentTracePanelSection } from "./OpenAgentTracePanelSectionCard.js"
import type { OpenAgentTraceEntryPanelModel } from "./panel-types.js"

const tone = toneFor("dsp")

export const OpenAgentTracePanelEntry = ({ entry }: { readonly entry: OpenAgentTraceEntryPanelModel }) => (
  <Stack className="gap-4">
    <ContentCard className={tone.border} density="standard" shape="left-accent">
      <Stack className="gap-3">
        <SemanticText
          as="p"
          className="text-ink-600 uppercase tracking-[0.16em]"
          role="code-meta"
          text={entry.eyebrow}
          variant="expanded"
        />
        <SemanticText as="h3" className="text-ink-900" role="section-title" text={entry.title} variant="expanded" />
        <SemanticText as="p" className="text-ink-700" role="card-summary" text={entry.summary} variant="expanded" />
      </Stack>
    </ContentCard>

    {entry.groups.map((group) => (
      <Cluster className="items-start gap-3" key={group.key}>
        {group.sections.map(renderOpenAgentTracePanelSection)}
      </Cluster>
    ))}
  </Stack>
)
