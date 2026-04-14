import { workflowEvidenceSectionTitles, workflowGraphVariantLabel } from "./evidence-presentation.js"
import type { WorkflowEvidenceSectionDescriptor } from "./evidence.js"

export const workflowEvidenceSectionTitle = (descriptor: WorkflowEvidenceSectionDescriptor): string =>
  descriptor.meaning === "overview"
    ? "Workflow Overview"
    : descriptor.meaning === "workflow-delta"
    ? "Workflow Delta"
    : descriptor.meaning === "variant-overview"
    ? `${workflowGraphVariantLabel(descriptor.variant)} Graph`
    : descriptor.meaning === "node-execution"
    ? `${workflowGraphVariantLabel(descriptor.variant)} · ${descriptor.nodeId}`
    : workflowEvidenceSectionTitles[
      descriptor.meaning === "optimization-study-progress"
        ? "optimizationStudyProgress"
        : descriptor.meaning === "optimization-study-summary"
        ? "optimizationStudySummary"
        : descriptor.meaning === "optimization-winner"
        ? "optimizationWinner"
        : descriptor.meaning === "optimization-snapshot"
        ? "optimizationSnapshot"
        : "optimizationStudyEventTrace"
    ]
