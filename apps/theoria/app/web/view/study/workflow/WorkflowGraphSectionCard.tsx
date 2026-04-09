import { workflowGraphCardMetricLabel } from "../../../../contracts/study/workflow/surface-graph-presentation.js"
import { workflowRichnessSectionTitle } from "../../../../contracts/study/workflow/surface-richness-presentation.js"
import type { WorkflowGraphViewModel } from "./graph-model.js"

import { ContentCard } from "../../primitives/ContentCard.js"
import { Cluster, Layer, Stack } from "../../primitives/Layout.js"
import { MetricCard } from "../../primitives/MetricCard.js"
import { SemanticText } from "../../primitives/SemanticText.js"

export const WorkflowGraphSectionCard = ({
  viewModel
}: {
  readonly viewModel: WorkflowGraphViewModel
}) => (
  <ContentCard density="standard">
    <Stack className="gap-3">
      <Stack className="gap-1">
        <SemanticText
          as="h3"
          className="text-ink-900"
          role="section-title"
          text={workflowRichnessSectionTitle("graph")}
          variant="expanded"
        />
        <SemanticText
          as="p"
          className="text-ink-700"
          role="status"
          text={viewModel.currentStep}
          variant="expanded"
        />
        <SemanticText
          as="p"
          className="text-ink-700"
          role="status"
          text={viewModel.currentStepMeta}
          variant="expanded"
        />
      </Stack>

      <Layer className="grid gap-3 lg:grid-cols-3">
        {viewModel.cards.map((card) => (
          <ContentCard density="compact" key={card.key}>
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
                <MetricCard label={workflowGraphCardMetricLabel("score")} value={card.score} />
                <MetricCard label={workflowGraphCardMetricLabel("nodes")} value={card.nodeCount} unit="count" />
              </Cluster>

              <SemanticText
                as="p"
                className="text-ink-700"
                role="status"
                text={card.detail}
                variant="expanded"
              />
            </Stack>
          </ContentCard>
        ))}
      </Layer>
    </Stack>
  </ContentCard>
)
