import {
  workflowRenderedPreviewScoreLabel,
  type WorkflowRenderedPreviewViewModel
} from "../../../../contracts/study/workflow/surface-rendered-preview-presentation.js"
import { workflowRichnessSectionTitle } from "../../../../contracts/study/workflow/surface-richness-presentation.js"

import { Cluster, Layer, Stack } from "../../primitives/Layout.js"
import { MetricCard } from "../../primitives/MetricCard.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { SurfaceSubsection } from "../../primitives/SurfaceSubsection.js"

export const WorkflowRenderedPreviewSectionCard = ({
  viewModel
}: {
  readonly viewModel: WorkflowRenderedPreviewViewModel
}) => (
  <SurfaceSubsection
    appearance="flush"
    className="py-5"
    summary={viewModel.description}
    title={workflowRichnessSectionTitle("rendered-preview")}
  >
    <Stack className="gap-3">
      <Layer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {viewModel.metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} surface="flush" value={metric.value} />
        ))}
      </Layer>

      <Layer className="grid gap-3 lg:grid-cols-2">
        {viewModel.panes.map((pane) => (
          <Stack className="gap-2 border-t border-stage-200/72 pt-3" key={pane.key}>
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
          </Stack>
        ))}
      </Layer>
    </Stack>
  </SurfaceSubsection>
)
