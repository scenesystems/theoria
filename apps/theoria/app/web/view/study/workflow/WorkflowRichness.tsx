import type { WorkflowSurfaceViewModel } from "../../../../contracts/study/workflow/surface-presentation.js"

import { Stack } from "../../primitives/Layout.js"
import { WorkflowGraphSectionCard } from "./WorkflowGraphSectionCard.js"
import { WorkflowProgressSectionCard } from "./WorkflowProgressSectionCard.js"
import { WorkflowRenderedPreviewSectionCard } from "./WorkflowRenderedPreviewSectionCard.js"
import { WorkflowTranscriptSectionCard } from "./WorkflowTranscriptSectionCard.js"

export const WorkflowRichness = ({
  viewModel
}: {
  readonly viewModel: WorkflowSurfaceViewModel
}) => (
  <Stack className="gap-0 divide-y divide-stage-200/72">
    <WorkflowProgressSectionCard viewModel={viewModel.progress} />
    <WorkflowGraphSectionCard viewModel={viewModel.graph} />
    <WorkflowTranscriptSectionCard viewModel={viewModel.transcript} />
    <WorkflowRenderedPreviewSectionCard viewModel={viewModel.renderedPreview} />
  </Stack>
)
