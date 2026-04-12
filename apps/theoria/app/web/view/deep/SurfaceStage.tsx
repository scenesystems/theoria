import { Match } from "effect"
import type { ReactNode } from "react"

import type { EvidencePlaneViewModel } from "../../../contracts/evidence/plane-presentation.js"
import { emptyEvidencePlaneViewModel } from "../../../contracts/evidence/plane-view-model.js"
import type { EvidencePlaneFilter, EvidencePlaneOrder } from "../../../contracts/evidence/plane.js"
import {
  runEvidenceComplete,
  type RunEvidenceControl,
  type RunEvidenceViewModel
} from "../../../contracts/presentation/run-evidence.js"
import type { SurfaceStageViewModel } from "../../../contracts/presentation/surface-stage.js"
import { EvidenceToolbar } from "../primitives/EvidenceToolbar.js"

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
  readonly banner: RunEvidenceViewModel["banner"]
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
  plane
}: {
  readonly banner: RunEvidenceViewModel["banner"]
  readonly emptyNode: ReactNode
  readonly onSelectFilter: (filter: EvidencePlaneFilter) => void
  readonly onSelectOrder: (order: EvidencePlaneOrder) => void
  readonly onSelectSection: (sectionKey: string | null) => void
  readonly plane: EvidencePlaneViewModel
}) =>
  plane.projectedSectionCount === 0
    ? emptyNode
    : evidenceSectionsNode({
      banner,
      onSelectFilter,
      onSelectOrder,
      onSelectSection,
      plane
    })

const inFlightEmptyNode = ({
  control,
  description
}: {
  readonly control: RunEvidenceControl
  readonly description: string
}): ReactNode =>
  Match.value(control).pipe(
    Match.withReturnType<ReactNode>(),
    Match.when("running", () => <RunningState text={description} />),
    Match.when("paused", () => <EmptyState description={description} />),
    Match.when("stopping", () => <RunningState text={description} />),
    Match.exhaustive
  )

export const EvidenceStage = ({
  onSelectEvidenceFilter,
  onSelectEvidenceOrder,
  onSelectEvidenceSection,
  viewModel
}: {
  readonly onSelectEvidenceFilter: (filter: EvidencePlaneFilter) => void
  readonly onSelectEvidenceOrder: (order: EvidencePlaneOrder) => void
  readonly onSelectEvidenceSection: (sectionKey: string | null) => void
  readonly viewModel: RunEvidenceViewModel & { readonly plane: EvidencePlaneViewModel }
}) =>
  Match.value(viewModel).pipe(
    Match.tag("RunEvidenceIdle", ({ description }) => <EmptyState description={description} />),
    Match.tag("RunEvidenceInFlight", ({ banner, control, description, plane }) =>
      retainedEvidenceNode({
        banner,
        emptyNode: inFlightEmptyNode({ control, description }),
        onSelectFilter: onSelectEvidenceFilter,
        onSelectOrder: onSelectEvidenceOrder,
        onSelectSection: onSelectEvidenceSection,
        plane
      })),
    Match.tag("RunEvidenceFailure", ({ banner, description, plane }) =>
      retainedEvidenceNode({
        banner,
        emptyNode: <FailureState description={description} />,
        onSelectFilter: onSelectEvidenceFilter,
        onSelectOrder: onSelectEvidenceOrder,
        onSelectSection: onSelectEvidenceSection,
        plane
      })),
    Match.tag("RunEvidenceResults", ({ banner, plane }) =>
      evidenceSectionsNode({
        banner,
        onSelectFilter: onSelectEvidenceFilter,
        onSelectOrder: onSelectEvidenceOrder,
        onSelectSection: onSelectEvidenceSection,
        plane
      })),
    Match.exhaustive
  )

export const SurfaceStage = ({
  interactiveContent,
  viewModel
}: {
  readonly interactiveContent: ReactNode | undefined
  readonly viewModel: SurfaceStageViewModel
}) => {
  const evidenceNode = (
    <EvidenceStage
      onSelectEvidenceFilter={() => undefined}
      onSelectEvidenceOrder={() => undefined}
      onSelectEvidenceSection={() => undefined}
      viewModel={{
        ...viewModel.evidence,
        plane: emptyEvidencePlaneViewModel({ complete: runEvidenceComplete(viewModel.evidence) })
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
