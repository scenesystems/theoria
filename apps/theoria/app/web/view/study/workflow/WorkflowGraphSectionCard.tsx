import { workflowGraphCardMetricLabel } from "../../../../contracts/study/workflow/surface-graph-presentation.js"
import type { WorkflowGraphViewModel } from "../../../../contracts/study/workflow/surface-graph-presentation.js"
import { workflowRichnessSectionTitle } from "../../../../contracts/study/workflow/surface-richness-presentation.js"

import { Cluster, Layer, Stack } from "../../primitives/Layout.js"
import { MetricCard } from "../../primitives/MetricCard.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { SurfaceSubsection } from "../../primitives/SurfaceSubsection.js"

export const WorkflowGraphSectionCard = ({
  viewModel
}: {
  readonly viewModel: WorkflowGraphViewModel
}) => (
  <SurfaceSubsection
    appearance="flush"
    className="py-5"
    summary={viewModel.currentStep}
    title={workflowRichnessSectionTitle("graph")}
  >
    <Stack className="gap-3">
      <SemanticText
        as="p"
        className="text-ink-700"
        role="status"
        text={viewModel.currentStepMeta}
        variant="expanded"
      />

      <Layer className="grid gap-3 lg:grid-cols-3">
        {viewModel.cards.map((card) => (
          <Stack className="gap-3 border-t border-stage-200/72 pt-3" key={card.key}>
            <Stack className="gap-3">
              <Stack className="gap-1">
                <SemanticText
                  as="h3"
                  className="text-ink-900"
                  role="section-title"
                  text={card.label}
                  variant="expanded"
                />
                <SemanticText
                  as="p"
                  className="text-ink-700"
                  role="status"
                  text={card.traversal}
                  variant="expanded"
                />
              </Stack>

              <Cluster className="grid gap-3 sm:grid-cols-2">
                <MetricCard label={workflowGraphCardMetricLabel("score")} surface="flush" value={card.score} />
                <MetricCard
                  label={workflowGraphCardMetricLabel("nodes")}
                  surface="flush"
                  value={card.nodeCount}
                  unit="count"
                />
              </Cluster>

              <SemanticText
                as="p"
                className="text-ink-700"
                role="status"
                text={card.detail}
                variant="expanded"
              />
            </Stack>
          </Stack>
        ))}
      </Layer>
    </Stack>
  </SurfaceSubsection>
)
