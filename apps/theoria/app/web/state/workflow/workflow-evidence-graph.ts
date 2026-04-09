import { Schema } from "effect"
import type { GraphVariant } from "effect-inference/Contracts"

import type { EvidenceSection } from "../../../contracts/evidence/item.js"
import { workflowEvidenceSectionTitle } from "../../../contracts/study/workflow/evidence-section-title.js"
import {
  workflowEvidenceItemKeys,
  type WorkflowEvidenceSectionMatch,
  workflowEvidenceSectionsForFamily,
  workflowLeadingTextRows,
  workflowNumericComparisonValueByKey,
  workflowScalarValueByKey,
  workflowTableRowsByKey,
  workflowVariantOverviewSectionKey
} from "../../../contracts/study/workflow/evidence.js"
import { WorkflowNumericComparisonProjection, WorkflowVariantGraphProjection } from "./workflow-evidence-schema.js"

export class WorkflowDeltaProjection extends Schema.Class<WorkflowDeltaProjection>("WorkflowDeltaProjection")({
  aggregateScore: WorkflowNumericComparisonProjection,
  graphNodes: WorkflowNumericComparisonProjection
}) {}

export class WorkflowGraphCatalogProjection extends Schema.Class<WorkflowGraphCatalogProjection>(
  "WorkflowGraphCatalogProjection"
)({
  baseline: WorkflowVariantGraphProjection,
  optimized: WorkflowVariantGraphProjection
}) {}

export class WorkflowGraphEvidenceProjection extends Schema.Class<WorkflowGraphEvidenceProjection>(
  "WorkflowGraphEvidenceProjection"
)({
  graphs: WorkflowGraphCatalogProjection,
  workflowDelta: WorkflowDeltaProjection
}) {
  static project(sections: ReadonlyArray<EvidenceSection>): WorkflowGraphEvidenceProjection {
    const graphSections = workflowEvidenceSectionsForFamily({ family: "graph", sections })
    const workflowDeltaSection =
      graphSections.find(({ descriptor }) => descriptor.meaning === "workflow-delta")?.section ?? null
    const baselineSection = graphSections.find(
      ({ descriptor }) => descriptor.meaning === "variant-overview" && descriptor.variant === "baseline"
    ) ?? null
    const optimizedSection = graphSections.find(
      ({ descriptor }) => descriptor.meaning === "variant-overview" && descriptor.variant === "optimized"
    ) ?? null

    return WorkflowGraphEvidenceProjection.make({
      workflowDelta: WorkflowDeltaProjection.make({
        aggregateScore: WorkflowNumericComparisonProjection.make(
          workflowNumericComparisonValueByKey(workflowDeltaSection, workflowEvidenceItemKeys.aggregateScore)
        ),
        graphNodes: WorkflowNumericComparisonProjection.make(
          workflowNumericComparisonValueByKey(workflowDeltaSection, workflowEvidenceItemKeys.graphNodes)
        )
      }),
      graphs: WorkflowGraphCatalogProjection.make({
        baseline: graphProjectionForVariant({ match: baselineSection, variant: "baseline" }),
        optimized: graphProjectionForVariant({ match: optimizedSection, variant: "optimized" })
      })
    })
  }
}

const graphProjectionForVariant = ({
  match,
  variant
}: {
  readonly match: WorkflowEvidenceSectionMatch<"graph"> | null
  readonly variant: GraphVariant
}): WorkflowVariantGraphProjection =>
  WorkflowVariantGraphProjection.make({
    title: workflowEvidenceSectionTitle(
      match?.descriptor ?? {
        family: "graph",
        key: workflowVariantOverviewSectionKey(variant),
        meaning: "variant-overview",
        variant
      }
    ),
    traversal: workflowLeadingTextRows(
      workflowTableRowsByKey(match?.section ?? null, workflowEvidenceItemKeys.traversal)
    ),
    traversalSteps: workflowScalarValueByKey(match?.section ?? null, workflowEvidenceItemKeys.traversalSteps)
  })
