import { Schema } from "effect"

import { EvidencePlaneFilter, EvidencePlaneOrder } from "./plane.js"
import { EvidenceMetric, EvidenceSectionProjection, EvidenceSectionViewModel } from "./section-presentation.js"

export class EvidencePlaneFilterOption extends Schema.Class<EvidencePlaneFilterOption>("EvidencePlaneFilterOption")({
  index: Schema.Number,
  label: Schema.String,
  value: EvidencePlaneFilter
}) {}

export class EvidencePlaneOrderOption extends Schema.Class<EvidencePlaneOrderOption>("EvidencePlaneOrderOption")({
  index: Schema.Number,
  label: Schema.String,
  value: EvidencePlaneOrder
}) {}

export class EvidencePlaneSectionOption extends Schema.Class<EvidencePlaneSectionOption>("EvidencePlaneSectionOption")({
  index: Schema.Number,
  label: Schema.String,
  value: Schema.NullOr(Schema.String)
}) {}

export const evidencePlaneFilterOptions: ReadonlyArray<EvidencePlaneFilterOption> = [
  EvidencePlaneFilterOption.make({ index: 0, label: "All", value: "all" }),
  EvidencePlaneFilterOption.make({ index: 1, label: "Results", value: "results" }),
  EvidencePlaneFilterOption.make({ index: 2, label: "Data", value: "data" }),
  EvidencePlaneFilterOption.make({ index: 3, label: "Context", value: "context" })
]

export const evidencePlaneOrderOptions: ReadonlyArray<EvidencePlaneOrderOption> = [
  EvidencePlaneOrderOption.make({ index: 0, label: "Narrative view", value: "narrative" }),
  EvidencePlaneOrderOption.make({ index: 1, label: "Live stream", value: "live" })
]

export class EvidencePlaneOrderingProjection
  extends Schema.Class<EvidencePlaneOrderingProjection>("EvidencePlaneOrderingProjection")({
    activeSectionKey: Schema.NullOr(Schema.String),
    sectionOptions: Schema.Array(EvidencePlaneSectionOption),
    visibleSections: Schema.Array(EvidenceSectionViewModel)
  })
{}

export class EvidencePlaneOverviewViewModel
  extends Schema.Class<EvidencePlaneOverviewViewModel>("EvidencePlaneOverviewViewModel")({
    eyebrow: Schema.String,
    description: Schema.String,
    metrics: Schema.Array(EvidenceMetric)
  })
{}

export class EvidencePlaneControlsViewModel
  extends Schema.Class<EvidencePlaneControlsViewModel>("EvidencePlaneControlsViewModel")({
    filterOptions: Schema.Array(EvidencePlaneFilterOption),
    activeFilterIndex: Schema.Number,
    orderOptions: Schema.Array(EvidencePlaneOrderOption),
    activeOrderIndex: Schema.Number,
    sectionOptions: Schema.Array(EvidencePlaneSectionOption),
    activeSectionIndex: Schema.Number
  })
{}

export class EvidencePlaneLane extends Schema.Class<EvidencePlaneLane>("EvidencePlaneLane")({
  eyebrow: Schema.String,
  title: Schema.String,
  description: Schema.String,
  sections: Schema.Array(EvidenceSectionViewModel)
}) {}

const EvidencePlaneLaneLayoutFields = {
  spotlight: Schema.Array(EvidenceSectionViewModel),
  lanes: Schema.Array(EvidencePlaneLane)
}

export class FocusedEvidencePlaneLayout extends Schema.TaggedClass<FocusedEvidencePlaneLayout>()("Focused", {
  section: EvidenceSectionViewModel
}) {}

export class NarrativeEvidencePlaneLayout extends Schema.TaggedClass<NarrativeEvidencePlaneLayout>()(
  "Narrative",
  EvidencePlaneLaneLayoutFields
) {}

export class LiveEvidencePlaneLayout extends Schema.TaggedClass<LiveEvidencePlaneLayout>()(
  "Live",
  EvidencePlaneLaneLayoutFields
) {}

export const EvidencePlaneLayout = Schema.Union(
  FocusedEvidencePlaneLayout,
  NarrativeEvidencePlaneLayout,
  LiveEvidencePlaneLayout
)

export type EvidencePlaneLayout = typeof EvidencePlaneLayout.Type

export class EvidencePlaneProjection extends Schema.Class<EvidencePlaneProjection>("EvidencePlaneProjection")({
  ordering: EvidencePlaneOrderingProjection,
  projectedSections: EvidenceSectionProjection
}) {}

export class EvidencePlaneViewModel extends Schema.Class<EvidencePlaneViewModel>("EvidencePlaneViewModel")({
  overview: EvidencePlaneOverviewViewModel,
  controls: EvidencePlaneControlsViewModel,
  layout: EvidencePlaneLayout,
  projectedSectionCount: Schema.Number,
  sections: Schema.Array(EvidenceSectionViewModel)
}) {}
