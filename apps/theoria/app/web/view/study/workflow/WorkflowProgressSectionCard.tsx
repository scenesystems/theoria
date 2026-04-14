import { presentationDetailRowsTableRows } from "../../../../contracts/presentation/detail-row.js"
import { workflowEvidenceTableColumns } from "../../../../contracts/study/workflow/evidence.js"
import type { WorkflowProgressViewModel } from "../../../../contracts/study/workflow/surface-progress-presentation.js"
import {
  workflowRichnessEmptyText,
  workflowRichnessSectionTitle,
  workflowRichnessTableLabel
} from "../../../../contracts/study/workflow/surface-richness-presentation.js"

import { DataTable } from "../../primitives/DataTable.js"
import { Layer, Stack } from "../../primitives/Layout.js"
import { MetricCard } from "../../primitives/MetricCard.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { SurfaceSubsection } from "../../primitives/SurfaceSubsection.js"

export const WorkflowProgressSectionCard = ({
  viewModel
}: {
  readonly viewModel: WorkflowProgressViewModel
}) => (
  <SurfaceSubsection
    appearance="flush"
    className="py-5"
    summary={viewModel.description}
    title={workflowRichnessSectionTitle("progress")}
  >
    <Stack className="gap-3">
      <Layer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {viewModel.metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} surface="flush" value={metric.value} />
        ))}
      </Layer>

      <Layer className="grid gap-3 lg:grid-cols-2">
        <DataTable
          columns={[...workflowEvidenceTableColumns.optimizationSnapshot]}
          label={workflowRichnessTableLabel("selection")}
          rows={presentationDetailRowsTableRows(viewModel.selectionRows)}
        />

        {viewModel.snapshotRows.length === 0
          ? (
            <Layer className="border-t border-stage-200/72 pt-3">
              <SemanticText
                as="p"
                className="text-ink-700"
                role="status"
                text={workflowRichnessEmptyText("snapshot")}
                variant="expanded"
              />
            </Layer>
          )
          : (
            <DataTable
              columns={[...workflowEvidenceTableColumns.optimizationSnapshot]}
              label={workflowRichnessTableLabel("snapshot")}
              rows={presentationDetailRowsTableRows(viewModel.snapshotRows)}
            />
          )}
      </Layer>

      {viewModel.eventRows.length === 0
        ? (
          <SemanticText
            as="p"
            className="text-ink-700"
            role="status"
            text={workflowRichnessEmptyText("event-trace")}
            variant="expanded"
          />
        )
        : (
          <DataTable
            columns={[...workflowEvidenceTableColumns.optimizationStudyEventTrace]}
            label={workflowRichnessTableLabel("event-trace")}
            rows={viewModel.eventRows}
          />
        )}
    </Stack>
  </SurfaceSubsection>
)
