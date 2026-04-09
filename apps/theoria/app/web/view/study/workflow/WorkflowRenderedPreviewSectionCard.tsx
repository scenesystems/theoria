import {
  workflowRenderedPreviewScoreLabel
} from "../../../../contracts/study/workflow/surface-rendered-preview-presentation.js"
import { workflowRichnessSectionTitle } from "../../../../contracts/study/workflow/surface-richness-presentation.js"
import type { WorkflowRenderedPreviewViewModel } from "./rendered-preview-model.js"

import { ContentCard } from "../../primitives/ContentCard.js"
import { Cluster, Layer, Stack } from "../../primitives/Layout.js"
import { MetricCard } from "../../primitives/MetricCard.js"
import { SemanticText } from "../../primitives/SemanticText.js"

export const WorkflowRenderedPreviewSectionCard = ({
  viewModel
}: {
  readonly viewModel: WorkflowRenderedPreviewViewModel
}) => (
  <ContentCard density="standard">
    <Stack className="gap-3">
      <Stack className="gap-1">
        <SemanticText
          as="h3"
          className="text-ink-900"
          role="section-title"
          text={workflowRichnessSectionTitle("rendered-preview")}
          variant="expanded"
        />
        <SemanticText
          as="p"
          className="text-ink-700"
          role="status"
          text={viewModel.description}
          variant="expanded"
        />
      </Stack>

      <Layer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {viewModel.metrics.map((metric) => <MetricCard key={metric.label} label={metric.label} value={metric.value} />)}
      </Layer>

      <Layer className="grid gap-3 lg:grid-cols-2">
        {viewModel.panes.map((pane) => (
          <ContentCard density="compact" key={pane.key}>
            <Stack className="gap-2">
              <Cluster className="items-baseline justify-between gap-3">
                <SemanticText
                  as="h3"
                  className="text-ink-900"
                  role="section-title"
                  text={pane.label}
                  variant="expanded"
                />
                <SemanticText
                  as="p"
                  className="text-ink-700"
                  role="row-label"
                  text={workflowRenderedPreviewScoreLabel(pane.score)}
                  variant="expanded"
                />
              </Cluster>
              <SemanticText
                as="p"
                className="text-ink-900"
                role="row-value"
                text={pane.body}
                variant="expanded"
              />
              <SemanticText
                as="p"
                className="text-ink-700"
                role="status"
                text={pane.note}
                variant="expanded"
              />
            </Stack>
          </ContentCard>
        ))}
      </Layer>
    </Stack>
  </ContentCard>
)
