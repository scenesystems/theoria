import { workflowEvidenceTableColumns } from "../../../../contracts/study/workflow/evidence.js"
import {
  workflowRichnessEmptyText,
  workflowRichnessSectionTitle,
  workflowRichnessTableLabel
} from "../../../../contracts/study/workflow/surface-richness-presentation.js"
import { workflowOptionalText } from "../../../../contracts/study/workflow/view-presentation.js"
import type { WorkflowTranscriptViewModel } from "../../../../contracts/study/workflow/view-presentation.js"

import { DataTable } from "../../primitives/DataTable.js"
import { Stack } from "../../primitives/Layout.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { SurfaceSubsection } from "../../primitives/SurfaceSubsection.js"

export const WorkflowTranscriptSectionCard = ({
  viewModel
}: {
  readonly viewModel: WorkflowTranscriptViewModel
}) => (
  <SurfaceSubsection
    appearance="flush"
    className="py-5"
    summary={viewModel.description}
    title={workflowRichnessSectionTitle("transcript")}
  >
    <Stack className="gap-3">
      {viewModel.entries.length === 0
        ? (
          <SemanticText
            as="p"
            className="text-ink-700"
            role="status"
            text={workflowRichnessEmptyText("transcript")}
            variant="expanded"
          />
        )
        : (
          <DataTable
            columns={[...workflowEvidenceTableColumns.nodeExecutionTranscript]}
            label={workflowRichnessTableLabel("transcript")}
            rows={viewModel.entries.map((entry) => [
              entry.title,
              entry.isCurrent ? `${entry.nodeId} (current)` : entry.nodeId,
              workflowOptionalText(entry.prompt),
              workflowOptionalText(entry.output),
              entry.totalTokens,
              entry.durationMs
            ])}
          />
        )}
    </Stack>
  </SurfaceSubsection>
)
