import { presentationDetailRowsTableRows } from "../../../../contracts/presentation/detail-row.js"
import { workflowEvidenceTableColumns } from "../../../../contracts/study/workflow/evidence.js"
import type { WorkflowProgressViewModel } from "../../../../contracts/study/workflow/surface-progress-presentation.js"
import {
  workflowRichnessEmptyText,
  workflowRichnessSectionTitle,
  workflowRichnessTableLabel
} from "../../../../contracts/study/workflow/surface-richness-presentation.js"

import { ContentCard } from "../../primitives/ContentCard.js"
import { DataTable } from "../../primitives/DataTable.js"
import { Layer, Stack } from "../../primitives/Layout.js"
import { MetricCard } from "../../primitives/MetricCard.js"
import { SemanticText } from "../../primitives/SemanticText.js"

export const WorkflowProgressSectionCard = ({
  viewModel
}: {
  readonly viewModel: WorkflowProgressViewModel
}) => (
  <ContentCard density="standard">
    <Stack className="gap-3">
      <Stack className="gap-1">
        <SemanticText
          as="h3"
          className="text-ink-900"
          role="section-title"
          text={workflowRichnessSectionTitle("progress")}
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

      <Layer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {viewModel.metrics.map((metric) => <MetricCard key={metric.label} label={metric.label} value={metric.value} />)}
      </Layer>

      <Layer className="grid gap-3 lg:grid-cols-2">
        <DataTable
          columns={[...workflowEvidenceTableColumns.optimizationSnapshot]}
          label={workflowRichnessTableLabel("selection")}
          rows={presentationDetailRowsTableRows(viewModel.selectionRows)}
        />

        {viewModel.snapshotRows.length === 0
          ? (
            <ContentCard density="compact">
              <SemanticText
                as="p"
                className="text-ink-700"
                role="status"
                text={workflowRichnessEmptyText("snapshot")}
                variant="expanded"
              />
            </ContentCard>
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
  </ContentCard>
)
