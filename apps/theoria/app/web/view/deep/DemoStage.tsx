import { Match } from "effect"
import type { ReactNode } from "react"

import {
  buildEvidencePlaneViewModel,
  type EvidencePlaneFilter,
  type EvidencePlaneOrder,
  type EvidencePlaneViewModel
} from "../data/evidence-layout.js"
import { EvidenceToolbar } from "../primitives/EvidenceToolbar.js"
import type { DemoEvidenceViewModel, DemoStageViewModel } from "./stageModel.js"

import { Layer, Stack } from "../primitives/Layout.js"
import { EmptyState, FailureState, RunningState } from "../primitives/Skeleton.js"
import { StageBanner } from "../primitives/StageBanner.js"

import { EvidenceSections } from "./EvidenceSections.js"

const stagePaneClassName = (active: boolean): string => active ? "min-h-0 flex-1" : "hidden min-h-0 flex-1"

const evidenceSectionsNode = ({
  banner,
  onSelectFilter,
  onSelectOrder,
  onSelectSection,
  plane
}: {
  readonly banner: DemoEvidenceViewModel["banner"]
  readonly onSelectFilter: (filter: EvidencePlaneFilter) => void
  readonly onSelectOrder: (order: EvidencePlaneOrder) => void
  readonly onSelectSection: (sectionKey: string | null) => void
  readonly plane: EvidencePlaneViewModel
}) => (
  <Stack className="gap-4 animate-fade-in-up">
    {banner === null
      ? null
      : <StageBanner text={banner.text} tone={banner.tone} />}
    <EvidenceToolbar
      onSelectFilter={onSelectFilter}
      onSelectOrder={onSelectOrder}
      onSelectSection={onSelectSection}
      viewModel={plane}
    />
    <EvidenceSections plane={plane} />
  </Stack>
)

const retainedEvidenceNode = ({
  banner,
  emptyNode,
  onSelectFilter,
  onSelectOrder,
  onSelectSection,
  plane,
  sections
}: {
  readonly banner: DemoEvidenceViewModel["banner"]
  readonly emptyNode: ReactNode
  readonly onSelectFilter: (filter: EvidencePlaneFilter) => void
  readonly onSelectOrder: (order: EvidencePlaneOrder) => void
  readonly onSelectSection: (sectionKey: string | null) => void
  readonly plane: EvidencePlaneViewModel
  readonly sections: DemoEvidenceViewModel["sections"]
}) =>
  sections.length === 0
    ? emptyNode
    : evidenceSectionsNode({
      banner,
      onSelectFilter,
      onSelectOrder,
      onSelectSection,
      plane
    })

export const EvidenceStage = ({
  onSelectEvidenceFilter,
  onSelectEvidenceOrder,
  onSelectEvidenceSection,
  viewModel
}: {
  readonly onSelectEvidenceFilter: (filter: EvidencePlaneFilter) => void
  readonly onSelectEvidenceOrder: (order: EvidencePlaneOrder) => void
  readonly onSelectEvidenceSection: (sectionKey: string | null) => void
  readonly viewModel: DemoEvidenceViewModel & { readonly plane: EvidencePlaneViewModel }
}) =>
  Match.value(viewModel).pipe(
    Match.tag("empty", ({ description }) => <EmptyState description={description} />),
    Match.tag("running", ({ banner, description, plane, sections }) =>
      retainedEvidenceNode({
        banner,
        emptyNode: <RunningState text={description} />,
        onSelectFilter: onSelectEvidenceFilter,
        onSelectOrder: onSelectEvidenceOrder,
        onSelectSection: onSelectEvidenceSection,
        plane,
        sections
      })),
    Match.tag("paused", ({ banner, description, plane, sections }) =>
      retainedEvidenceNode({
        banner,
        emptyNode: <EmptyState description={description} />,
        onSelectFilter: onSelectEvidenceFilter,
        onSelectOrder: onSelectEvidenceOrder,
        onSelectSection: onSelectEvidenceSection,
        plane,
        sections
      })),
    Match.tag("stopped", ({ banner, description, plane, sections }) =>
      retainedEvidenceNode({
        banner,
        emptyNode: <EmptyState description={description} />,
        onSelectFilter: onSelectEvidenceFilter,
        onSelectOrder: onSelectEvidenceOrder,
        onSelectSection: onSelectEvidenceSection,
        plane,
        sections
      })),
    Match.tag("failure", ({ banner, description, plane, sections }) =>
      retainedEvidenceNode({
        banner,
        emptyNode: <FailureState description={description} />,
        onSelectFilter: onSelectEvidenceFilter,
        onSelectOrder: onSelectEvidenceOrder,
        onSelectSection: onSelectEvidenceSection,
        plane,
        sections
      })),
    Match.tag("results", ({ banner, plane }) =>
      evidenceSectionsNode({
        banner,
        onSelectFilter: onSelectEvidenceFilter,
        onSelectOrder: onSelectEvidenceOrder,
        onSelectSection: onSelectEvidenceSection,
        plane
      })),
    Match.exhaustive
  )

export const DemoStage = ({
  interactiveContent,
  viewModel
}: {
  readonly interactiveContent: ReactNode | undefined
  readonly viewModel: DemoStageViewModel
}) => {
  const defaultPlane = buildEvidencePlaneViewModel({
    complete: viewModel.evidence._tag === "results",
    filter: "all",
    meta: null,
    order: "narrative",
    sections: viewModel.evidence.sections,
    sectionKey: null,
    summary: null
  })
  const evidenceNode = (
    <EvidenceStage
      onSelectEvidenceFilter={() => undefined}
      onSelectEvidenceOrder={() => undefined}
      onSelectEvidenceSection={() => undefined}
      viewModel={{
        ...viewModel.evidence,
        plane: defaultPlane
      }}
    />
  )

  if (!viewModel.showTabs || interactiveContent === undefined) {
    return <Layer className="min-h-0 flex-1">{evidenceNode}</Layer>
  }

  return (
    <Stack className="min-h-0 h-full flex-1 gap-0">
      <Layer className={stagePaneClassName(viewModel.activeTab === "interactive")}>{interactiveContent}</Layer>
      <Layer className={stagePaneClassName(viewModel.activeTab === "evidence")}>{evidenceNode}</Layer>
    </Stack>
  )
}
