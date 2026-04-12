import { workflowEvidenceTableColumns } from "../../../../contracts/study/workflow/evidence.js"
import {
  workflowRichnessEmptyText,
  workflowRichnessSectionTitle,
  workflowRichnessTableLabel
} from "../../../../contracts/study/workflow/surface-richness-presentation.js"
import { workflowOptionalText } from "../../../../contracts/study/workflow/view-presentation.js"
import type { WorkflowTranscriptViewModel } from "../../../../contracts/study/workflow/view-presentation.js"

import { ContentCard } from "../../primitives/ContentCard.js"
import { DataTable } from "../../primitives/DataTable.js"
import { Stack } from "../../primitives/Layout.js"
import { SemanticText } from "../../primitives/SemanticText.js"

export const WorkflowTranscriptSectionCard = ({
  viewModel
}: {
  readonly viewModel: WorkflowTranscriptViewModel
}) => (
  <ContentCard density="standard">
    <Stack className="gap-3">
      <Stack className="gap-1">
        <SemanticText
          as="h3"
          className="text-ink-900"
          role="section-title"
          text={workflowRichnessSectionTitle("transcript")}
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
  </ContentCard>
)
