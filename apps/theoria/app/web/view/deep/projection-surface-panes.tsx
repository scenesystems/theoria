import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"
import { lazy, Suspense } from "react"

import type { EntryId } from "../../../contracts/entry/id.js"
import { DeepDiveSurfacePlaneValue } from "../../../contracts/presentation/layout.js"
import { deepDiveEvidenceAtom } from "../../atoms/derived.js"
import {
  selectEvidencePlaneFilterAtom,
  selectEvidencePlaneOrderAtom,
  selectEvidencePlaneSectionAtom
} from "../../atoms/evidence/plane.js"
import { interactiveWidgetFor, projectionPlaneHintFor } from "../../runtime/kernel/surface-view.js"
import {
  DeepDiveDiagnosticsPlaneValue,
  type DeepDiveProjectionPlane,
  diagnosticsProjectionEnabled
} from "../../state/surface/deep-dive.js"
import { Pane } from "../containers/Pane.js"
import { Stack } from "../primitives/Layout.js"
import { ProgramCodePanel } from "../primitives/ProgramCodePanel.js"
import { ProjectionOrdinal } from "../primitives/ProjectionOrdinal.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { SurfaceViewport } from "../primitives/SurfaceViewport.js"
import { badgeFromSurface } from "../primitives/theme/badge.js"
import { type Surface, surfaceForCard } from "../primitives/theme/surface.js"

import type { DeepDiveProjectionSurfaceDescriptor, DeepDiveProjectionSurfacePane } from "./projection-model.js"
import { projectionSurfaceOrdinalLabel } from "./projection-model.js"
import type { DeepDiveProjectionSurfaceContext } from "./projection-surface-context.js"
import { ProjectionSurfaceFramePane, projectionSurfacePaneClassName } from "./ProjectionSurfaceFramePane.js"
import { EvidenceStage } from "./SurfaceStage.js"

const RunLifecycleDiagnosticsDevPane = import.meta.env.DEV
  ? lazy(() => import("./RunLifecycleDiagnosticsDevPane.js"))
  : null

const projectionSurfacePaneChrome = ({
  context,
  descriptor,
  hintText
}: {
  readonly context: DeepDiveProjectionSurfaceContext
  readonly descriptor: DeepDiveProjectionSurfaceDescriptor
  readonly hintText: string
}) => {
  const theme = surfaceForCard(context.id)

  return {
    badge: projectionBadge({ projectionIndex: context.projectionIndex, theme }),
    hintText,
    summaryText: descriptor.description,
    theme,
    title: descriptor.label
  }
}

const projectionBadge = ({ projectionIndex, theme }: {
  readonly projectionIndex: number | null
  readonly theme: Surface
}) => {
  const label = projectionSurfaceOrdinalLabel(projectionIndex)

  return label === null
    ? null
    : (
      <ProjectionOrdinal
        badge={badgeFromSurface(theme)}
        label={label}
        variant="expanded"
      />
    )
}

const ConnectedEvidenceStage = ({ id }: { readonly id: EntryId }) => {
  const evidence = useAtomValue(deepDiveEvidenceAtom(id))
  const selectEvidenceFilter = useAtomSet(selectEvidencePlaneFilterAtom)
  const selectEvidenceOrder = useAtomSet(selectEvidencePlaneOrderAtom)
  const selectEvidenceSection = useAtomSet(selectEvidencePlaneSectionAtom)

  return (
    <EvidenceStage
      onSelectEvidenceFilter={(filter) => {
        selectEvidenceFilter({ filter, id })
      }}
      onSelectEvidenceOrder={(order) => {
        selectEvidenceOrder({ id, order })
      }}
      onSelectEvidenceSection={(sectionKey) => {
        selectEvidenceSection({ id, sectionKey })
      }}
      viewModel={evidence}
    />
  )
}

const StageProjectionFallback = () => (
  <Stack className="max-w-2xl gap-3 py-2">
    <SemanticText as="h3" className="text-ink-900" role="section-title" text="Projection Surface" variant="expanded" />
    <SemanticText
      as="p"
      className="text-ink-700"
      role="status"
      text="This surface projects directly into the evidence and source planes. Run it to materialize the canonical outputs side by side."
      variant="expanded"
    />
  </Stack>
)

const stagePane = ({ context, descriptor }: {
  readonly context: DeepDiveProjectionSurfaceContext
  readonly descriptor: DeepDiveProjectionSurfaceDescriptor
}): DeepDiveProjectionSurfacePane["pane"] => {
  const hints = projectionPlaneHintFor(context.id)
  const chrome = projectionSurfacePaneChrome({ context, descriptor, hintText: hints.stage })
  const interactiveContent = interactiveWidgetFor(context.id)

  return (
    <ProjectionSurfaceFramePane {...chrome} scroll="vertical">
      <SurfaceViewport>{interactiveContent ?? <StageProjectionFallback />}</SurfaceViewport>
    </ProjectionSurfaceFramePane>
  )
}

const evidencePane = ({ context, descriptor }: {
  readonly context: DeepDiveProjectionSurfaceContext
  readonly descriptor: DeepDiveProjectionSurfaceDescriptor
}): DeepDiveProjectionSurfacePane["pane"] => {
  const hints = projectionPlaneHintFor(context.id)
  const chrome = projectionSurfacePaneChrome({ context, descriptor, hintText: hints.evidence })

  return (
    <ProjectionSurfaceFramePane {...chrome} scroll="vertical">
      <ConnectedEvidenceStage id={context.id} />
    </ProjectionSurfaceFramePane>
  )
}

const sourcePane = ({
  context,
  descriptor
}: {
  readonly context: DeepDiveProjectionSurfaceContext
  readonly descriptor: DeepDiveProjectionSurfaceDescriptor
}): DeepDiveProjectionSurfacePane["pane"] => {
  const hints = projectionPlaneHintFor(context.id)
  const { badge, hintText, summaryText, theme } = projectionSurfacePaneChrome({
    context,
    descriptor,
    hintText: hints.source
  })

  return (
    <Pane className={projectionSurfacePaneClassName} scroll="none">
      <ProgramCodePanel
        badge={badge}
        codeClassName={theme.codePanel.codeContainer}
        codePanel={theme.codePanel}
        entry={context.frameViewModel.code.entry}
        fileName={context.frameViewModel.code.fileName}
        filesVisible={context.sourceExplorerVisible}
        fileTabs={context.frameViewModel.code.fileTabs}
        hintText={hintText}
        onSelectFile={context.onSelectFile}
        onSelectSourceScope={context.onSelectSourceScope}
        onToggleFilesVisible={context.onToggleSourceExplorerVisible}
        selectedFileIndex={context.frameViewModel.code.selectedFileIndex}
        selectedSourceScope={context.frameViewModel.code.selectedSourceScope}
        source={context.frameViewModel.code.source}
        sourceTabs={context.frameViewModel.code.sourceTabs}
        summaryText={summaryText}
        variant="expanded"
      />
    </Pane>
  )
}

const diagnosticsPane = ({
  context,
  descriptor
}: {
  readonly context: DeepDiveProjectionSurfaceContext
  readonly descriptor: DeepDiveProjectionSurfaceDescriptor
}): DeepDiveProjectionSurfacePane["pane"] => {
  const chrome = projectionSurfacePaneChrome({
    context,
    descriptor,
    hintText: "Development-only reducer and projection-driver diagnostics. Excluded from production builds."
  })

  return (
    <ProjectionSurfaceFramePane {...chrome} scroll="vertical">
      {diagnosticsProjectionEnabled && RunLifecycleDiagnosticsDevPane !== null
        ? (
          <Suspense fallback={null}>
            <RunLifecycleDiagnosticsDevPane id={context.id} />
          </Suspense>
        )
        : null}
    </ProjectionSurfaceFramePane>
  )
}

export const deepDiveProjectionPaneFor = ({
  context,
  descriptor,
  surface
}: {
  readonly context: DeepDiveProjectionSurfaceContext
  readonly descriptor: DeepDiveProjectionSurfaceDescriptor
  readonly surface: DeepDiveProjectionPlane
}): DeepDiveProjectionSurfacePane["pane"] =>
  Match.value(surface).pipe(
    Match.when(DeepDiveSurfacePlaneValue.Stage, () => stagePane({ context, descriptor })),
    Match.when(DeepDiveSurfacePlaneValue.Evidence, () => evidencePane({ context, descriptor })),
    Match.when(DeepDiveSurfacePlaneValue.Source, () => sourcePane({ context, descriptor })),
    Match.when(DeepDiveDiagnosticsPlaneValue, () => diagnosticsPane({ context, descriptor })),
    Match.exhaustive
  )
