import type { OpenAgentTracePanelModel } from "../../../../contracts/study/workflow/open-agent-trace.js"
import { Badge } from "../../../ui/components/feedback/Badge.js"
import { Card } from "../../../ui/components/surface/Card.js"
import { Panel } from "../../../ui/components/surface/Panel.js"
import { SectionHeader } from "../../../ui/components/surface/SectionHeader.js"
import { Grid } from "../../../ui/structure/Grid.js"
import { SemanticText } from "../../../ui/structure/SemanticText.js"
import { Stack } from "../../../ui/structure/Stack.js"

import { corpusLaneLabel, corpusLaneTone } from "../model.js"

export const TraceRecordPanel = ({ model }: { readonly model: OpenAgentTracePanelModel }) => (
  <Panel padding="lg" tone="default">
    <Stack gap="md">
      <SectionHeader
        description={model.description}
        eyebrow="Trace records"
        meta={<Badge tone={corpusLaneTone(model.corpusLane.label)}>{corpusLaneLabel(model.corpusLane.label)}</Badge>}
        title="Corpus lane summary"
      />
      <Grid columns={4} gap="md">
        {model.summaryRows.map((row) => (
          <Card key={row.label} padding="sm" tone="muted">
            <Stack gap="xs">
              <SemanticText role="label" tone="muted">
                {row.label}
              </SemanticText>
              <SemanticText role="display-sm">{row.value}</SemanticText>
            </Stack>
          </Card>
        ))}
      </Grid>
    </Stack>
  </Panel>
)
