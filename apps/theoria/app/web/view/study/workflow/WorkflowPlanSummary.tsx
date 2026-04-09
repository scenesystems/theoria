import {
  workflowPlanSummaryMetricRows,
  workflowPlanSummaryPhaseDetail
} from "../../../../contracts/study/workflow/plan-presentation.js"
import type { WorkflowSurfaceViewModel } from "./surface-model.js"

import { ContentCard } from "../../primitives/ContentCard.js"
import { Layer, Stack } from "../../primitives/Layout.js"
import { MetricCard } from "../../primitives/MetricCard.js"
import { SemanticText } from "../../primitives/SemanticText.js"

export const WorkflowPlanSummary = ({
  viewModel
}: {
  readonly viewModel: WorkflowSurfaceViewModel
}) => {
  const metrics = workflowPlanSummaryMetricRows({
    phaseLabel: viewModel.phaseLabel,
    plan: viewModel.plan,
    runStory: viewModel.runStory
  })

  return (
    <ContentCard density="standard">
      <Stack className="gap-4">
        <Stack className="gap-2">
          <SemanticText
            as="h3"
            className="text-ink-900"
            role="section-title"
            text={viewModel.selection.label}
            variant="expanded"
          />
          <SemanticText
            as="p"
            className="text-ink-700"
            role="status"
            text={viewModel.selection.summary}
            variant="expanded"
          />
        </Stack>

        <Layer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.key}
              label={metric.label}
              value={metric.value}
              {...(metric.unit === undefined ? {} : { unit: metric.unit })}
            />
          ))}
        </Layer>

        <SemanticText
          as="p"
          className="text-ink-700"
          role="status"
          text={workflowPlanSummaryPhaseDetail(viewModel.phaseDetail)}
          variant="expanded"
        />
      </Stack>
    </ContentCard>
  )
}
