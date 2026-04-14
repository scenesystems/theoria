import {
  workflowPlanSummaryMetricRows,
  workflowPlanSummaryPhaseDetail
} from "../../../../contracts/study/workflow/plan-presentation.js"
import type { WorkflowSurfaceViewModel } from "../../../../contracts/study/workflow/surface-presentation.js"

import { Layer, Stack } from "../../primitives/Layout.js"
import { MetricCard } from "../../primitives/MetricCard.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { SurfaceSubsection } from "../../primitives/SurfaceSubsection.js"

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
    <SurfaceSubsection
      appearance="flush"
      summary={viewModel.runStory}
      title="Run plan"
    >
      <Stack className="gap-4">
        <Stack className="gap-1.5">
          <SemanticText
            as="span"
            className="text-ink-500"
            role="row-label"
            text="Current workflow"
            variant="compact"
          />
          <SemanticText
            as="p"
            className="text-ink-900"
            role="row-value"
            text={viewModel.selector.selected.label}
            variant="expanded"
          />
          <SemanticText
            as="p"
            className="text-ink-700"
            role="status"
            text={viewModel.selector.selected.summary}
            variant="expanded"
          />
        </Stack>

        <Layer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.key}
              label={metric.label}
              surface="flush"
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
    </SurfaceSubsection>
  )
}
