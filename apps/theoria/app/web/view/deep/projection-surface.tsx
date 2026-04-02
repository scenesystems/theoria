import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"
import { lazy, Suspense } from "react"

import type { Id } from "../../../contracts/id.js"
import { DeepDiveSurfacePlaneValue } from "../../../contracts/layout.js"
import type { ProgramSourceScope } from "../../../contracts/presentation.js"
import { deepDiveEvidenceAtom } from "../../atoms/derived.js"
import {
  selectEvidencePlaneFilterAtom,
  selectEvidencePlaneOrderAtom,
  selectEvidencePlaneSectionAtom
} from "../../atoms/evidence-plane.js"
import {
  DeepDiveDiagnosticsPlaneValue,
  type DeepDiveProjectionPlane,
  diagnosticsProjectionEnabled
} from "../../state/deep-dive-surface.js"
import { Pane } from "../containers/Pane.js"
import { badgeThemeFromSurface, type SurfaceTheme, surfaceThemeForCard } from "../primitives/designSystem.js"
import { Stack } from "../primitives/Layout.js"
import { ProgramCodePanel } from "../primitives/ProgramCodePanel.js"
import { ProjectionOrdinal } from "../primitives/ProjectionOrdinal.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { SurfacePlaneFrame } from "../primitives/SurfacePlaneFrame.js"
import { SurfaceViewport } from "../primitives/SurfaceViewport.js"
import type { DeepDiveSurfaceFrameViewModel } from "../surfaceModel.js"

import { EvidenceStage } from "./DemoStage.js"
import { projectionPlaneHintFor } from "./interactiveMetadata.js"
import { interactiveWidgetFor } from "./interactiveWidgets.js"
import { type DeepDiveProjectionSurface, deepDiveProjectionSurfaceDescriptorFor } from "./projection-model.js"

const RunLifecycleDiagnosticsDevPane = import.meta.env.DEV
  ? lazy(() => import("./RunLifecycleDiagnosticsDevPane.js"))
  : null

type DeepDiveProjectionSurfaceContext = {
  readonly frameViewModel: DeepDiveSurfaceFrameViewModel
  readonly id: Id
  readonly onSelectFile: (fileIndex: number) => void
  readonly onSelectSourceScope: (scope: ProgramSourceScope) => void
  readonly projectionIndex: number | null
  readonly onToggleSourceExplorerVisible: () => void
  readonly sourceExplorerVisible: boolean
}

type DeepDiveProjectionSurfaceDescriptor = {
  readonly description: DeepDiveProjectionSurface["description"]
  readonly id: DeepDiveProjectionSurface["id"]
  readonly label: DeepDiveProjectionSurface["label"]
}

type DeepDiveProjectionSurfaceDefinition = DeepDiveProjectionSurfaceDescriptor & {
  readonly pane: DeepDiveProjectionSurface["pane"]
}

const projectionPaneClassName = "min-h-0 h-full flex-1 bg-stage-0"

const projectionBadge = ({
  projectionIndex,
  theme
}: {
  readonly projectionIndex: number | null
  readonly theme: SurfaceTheme
}) =>
  projectionIndex === null
    ? null
    : (
      <ProjectionOrdinal
        badge={badgeThemeFromSurface(theme)}
        label={`P${projectionIndex + 1}`}
        variant="expanded"
      />
    )

const ConnectedEvidenceStage = ({
  id
}: {
  readonly id: Id
}) => {
  const evidence = useAtomValue(deepDiveEvidenceAtom(id))
  const selectEvidenceFilter = useAtomSet(selectEvidencePlaneFilterAtom)
  const selectEvidenceOrder = useAtomSet(selectEvidencePlaneOrderAtom)
  const selectEvidenceSection = useAtomSet(selectEvidencePlaneSectionAtom)

  return evidence === null
    ? null
    : (
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
      text="This package projects directly into the evidence and source planes. Run the demo to materialize the reproducible outputs side by side."
      variant="expanded"
    />
  </Stack>
)

const stagePane = ({
  context,
  descriptor
}: {
  readonly context: DeepDiveProjectionSurfaceContext
  readonly descriptor: DeepDiveProjectionSurfaceDescriptor
}): DeepDiveProjectionSurface["pane"] => {
  const hints = projectionPlaneHintFor(context.id)
  const interactiveContent = interactiveWidgetFor(context.id)
  const theme = surfaceThemeForCard(context.id)

  return (
    <Pane className={projectionPaneClassName} scroll="vertical">
      <SurfacePlaneFrame
        badge={projectionBadge({ projectionIndex: context.projectionIndex, theme })}
        hintText={hints.stage}
        summaryText={descriptor.description}
        title={descriptor.label}
        variant="expanded"
      >
        <SurfaceViewport>{interactiveContent ?? <StageProjectionFallback />}</SurfaceViewport>
      </SurfacePlaneFrame>
    </Pane>
  )
}

const evidencePane = ({
  context,
  descriptor
}: {
  readonly context: DeepDiveProjectionSurfaceContext
  readonly descriptor: DeepDiveProjectionSurfaceDescriptor
}): DeepDiveProjectionSurface["pane"] => {
  const hints = projectionPlaneHintFor(context.id)
  const theme = surfaceThemeForCard(context.id)

  return (
    <Pane className={projectionPaneClassName} scroll="vertical">
      <SurfacePlaneFrame
        badge={projectionBadge({ projectionIndex: context.projectionIndex, theme })}
        hintText={hints.evidence}
        summaryText={descriptor.description}
        title={descriptor.label}
        variant="expanded"
      >
        <ConnectedEvidenceStage
          id={context.id}
        />
      </SurfacePlaneFrame>
    </Pane>
  )
}

const sourcePane = ({
  context,
  descriptor
}: {
  readonly context: DeepDiveProjectionSurfaceContext
  readonly descriptor: DeepDiveProjectionSurfaceDescriptor
}): DeepDiveProjectionSurface["pane"] => {
  const hints = projectionPlaneHintFor(context.id)
  const theme = surfaceThemeForCard(context.id)

  return (
    <Pane className={projectionPaneClassName} scroll="none">
      <ProgramCodePanel
        badge={projectionBadge({ projectionIndex: context.projectionIndex, theme })}
        codeClassName={theme.codePanel.codeContainer}
        codePanelTheme={theme.codePanel}
        entry={context.frameViewModel.code.entry}
        fileName={context.frameViewModel.code.fileName}
        filesVisible={context.sourceExplorerVisible}
        fileTabs={context.frameViewModel.code.fileTabs}
        hintText={hints.source}
        onSelectFile={context.onSelectFile}
        onSelectSourceScope={context.onSelectSourceScope}
        onToggleFilesVisible={context.onToggleSourceExplorerVisible}
        selectedFileIndex={context.frameViewModel.code.selectedFileIndex}
        selectedSourceScope={context.frameViewModel.code.selectedSourceScope}
        source={context.frameViewModel.code.source}
        sourceTabs={context.frameViewModel.code.sourceTabs}
        summaryText={descriptor.description}
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
}): DeepDiveProjectionSurface["pane"] => {
  const theme = surfaceThemeForCard(context.id)

  return (
    <Pane className={projectionPaneClassName} scroll="vertical">
      <SurfacePlaneFrame
        badge={projectionBadge({ projectionIndex: context.projectionIndex, theme })}
        hintText="Development-only reducer and local-driver diagnostics. Excluded from production builds."
        summaryText={descriptor.description}
        title={descriptor.label}
        variant="expanded"
      >
        {diagnosticsProjectionEnabled && RunLifecycleDiagnosticsDevPane !== null
          ? (
            <Suspense fallback={null}>
              <RunLifecycleDiagnosticsDevPane id={context.id} />
            </Suspense>
          )
          : null}
      </SurfacePlaneFrame>
    </Pane>
  )
}

export const deepDiveProjectionSurfaceFor = (
  surface: DeepDiveProjectionPlane,
  context: DeepDiveProjectionSurfaceContext
): DeepDiveProjectionSurfaceDefinition => {
  const descriptor = deepDiveProjectionSurfaceDescriptorFor(surface)

  return {
    ...descriptor,
    pane: Match.value(surface).pipe(
      Match.when(DeepDiveSurfacePlaneValue.Stage, () => stagePane({ context, descriptor })),
      Match.when(DeepDiveSurfacePlaneValue.Evidence, () => evidencePane({ context, descriptor })),
      Match.when(DeepDiveSurfacePlaneValue.Source, () => sourcePane({ context, descriptor })),
      Match.when(DeepDiveDiagnosticsPlaneValue, () => diagnosticsPane({ context, descriptor })),
      Match.exhaustive
    )
  }
}
