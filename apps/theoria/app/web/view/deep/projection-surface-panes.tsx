import { Match } from "effect"
import { lazy, Suspense } from "react"

import { EntryPresentation } from "../../../contracts/entry/routing.js"
import {
  type DeepDiveProjectionFallbackContent,
  type DeepDiveProjectionPaneChrome,
  deepDiveProjectionPaneChrome
} from "../../../contracts/presentation/deep-dive-pane.js"
import type { DeepDiveProjectionSurfacePane } from "../../../contracts/presentation/deep-dive-projection-model.js"
import {
  DeepDiveDiagnosticsPlaneValue,
  type DeepDiveProjectionPlane
} from "../../../contracts/presentation/deep-dive-projection.js"
import { DeepDiveSurfacePlaneValue } from "../../../contracts/presentation/layout.js"
import { diagnosticsProjectionEnabled } from "../../state/surface/deep-dive.js"
import { Pane } from "../containers/Pane.js"
import { Stack } from "../primitives/Layout.js"
import { ProgramCodePanel } from "../primitives/ProgramCodePanel.js"
import { ProjectionOrdinal } from "../primitives/ProjectionOrdinal.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { SurfaceViewport } from "../primitives/SurfaceViewport.js"
import { badgeFromSurface } from "../primitives/theme/badge.js"
import { type Surface, surfaceForCard } from "../primitives/theme/surface.js"

import { projectionSourcePaneInput } from "./projection-source-pane-input.js"
import { projectionStagePaneInput } from "./projection-stage-pane-input.js"
import type { DeepDiveProjectionSurfaceContext } from "./projection-surface-context.js"
import { ProjectionEvidenceStage } from "./ProjectionEvidenceStage.js"
import { ProjectionSurfaceFramePane, projectionSurfacePaneClassName } from "./ProjectionSurfaceFramePane.js"

const RunLifecycleDiagnosticsDevPane = import.meta.env.DEV
  ? lazy(() => import("./RunLifecycleDiagnosticsDevPane.js"))
  : null

const projectionBadge = ({ badgeLabel, theme }: {
  readonly badgeLabel: string | null
  readonly theme: Surface
}) => {
  return badgeLabel === null
    ? null
    : (
      <ProjectionOrdinal
        badge={badgeFromSurface(theme)}
        label={badgeLabel}
        variant="expanded"
      />
    )
}

const projectionSurfacePaneChrome = ({
  chrome,
  theme
}: {
  readonly chrome: DeepDiveProjectionPaneChrome
  readonly theme: Surface
}) => ({
  badge: projectionBadge({ badgeLabel: chrome.badgeLabel, theme }),
  hintText: chrome.hintText,
  summaryText: chrome.summaryText,
  title: chrome.title
})

const themedProjectionSurfacePaneChrome = ({
  context,
  surface
}: {
  readonly context: DeepDiveProjectionSurfaceContext
  readonly surface: DeepDiveProjectionPlane
}) => {
  const theme = surfaceForCard(context.id)
  const chrome = deepDiveProjectionPaneChrome({
    projectionHint: EntryPresentation.fromEntryId(context.id).projectionHint,
    projectionIndex: context.projectionIndex,
    surface
  })

  return {
    chrome: projectionSurfacePaneChrome({ chrome, theme }),
    theme
  }
}

const StageProjectionFallback = ({
  content
}: {
  readonly content: DeepDiveProjectionFallbackContent
}) => (
  <Stack className="max-w-2xl gap-3 py-2">
    <SemanticText
      as="h3"
      className="text-ink-900"
      role="section-title"
      text={content.title}
      variant="expanded"
    />
    <SemanticText
      as="p"
      className="text-ink-700"
      role="status"
      text={content.description}
      variant="expanded"
    />
  </Stack>
)

const stagePane = (
  { context }: { readonly context: DeepDiveProjectionSurfaceContext }
): DeepDiveProjectionSurfacePane["pane"] => {
  const { chrome } = themedProjectionSurfacePaneChrome({ context, surface: DeepDiveSurfacePlaneValue.Stage })
  const input = projectionStagePaneInput({ entryId: context.id })

  return (
    <ProjectionSurfaceFramePane {...chrome} scroll="vertical">
      <SurfaceViewport>
        {input.interactiveContent ?? <StageProjectionFallback content={input.fallbackContent} />}
      </SurfaceViewport>
    </ProjectionSurfaceFramePane>
  )
}

const evidencePane = (
  { context }: { readonly context: DeepDiveProjectionSurfaceContext }
): DeepDiveProjectionSurfacePane["pane"] => {
  const { chrome } = themedProjectionSurfacePaneChrome({ context, surface: DeepDiveSurfacePlaneValue.Evidence })

  return (
    <ProjectionSurfaceFramePane {...chrome} scroll="vertical">
      <ProjectionEvidenceStage id={context.id} />
    </ProjectionSurfaceFramePane>
  )
}

const sourcePane = ({
  context,
  surface
}: {
  readonly context: DeepDiveProjectionSurfaceContext
  readonly surface: DeepDiveProjectionPlane
}): DeepDiveProjectionSurfacePane["pane"] => {
  const { chrome, theme } = themedProjectionSurfacePaneChrome({ context, surface })
  const input = projectionSourcePaneInput({ chrome, context, theme })

  return (
    <Pane className={projectionSurfacePaneClassName} scroll="none">
      <ProgramCodePanel {...input} variant="expanded" />
    </Pane>
  )
}

const diagnosticsPane = ({
  context
}: {
  readonly context: DeepDiveProjectionSurfaceContext
}): DeepDiveProjectionSurfacePane["pane"] => {
  const { chrome } = themedProjectionSurfacePaneChrome({ context, surface: DeepDiveDiagnosticsPlaneValue })

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
  surface
}: {
  readonly context: DeepDiveProjectionSurfaceContext
  readonly surface: DeepDiveProjectionPlane
}): DeepDiveProjectionSurfacePane["pane"] =>
  Match.value(surface).pipe(
    Match.when(DeepDiveSurfacePlaneValue.Stage, () => stagePane({ context })),
    Match.when(DeepDiveSurfacePlaneValue.Evidence, () => evidencePane({ context })),
    Match.when(DeepDiveSurfacePlaneValue.Source, () => sourcePane({ context, surface })),
    Match.when(DeepDiveDiagnosticsPlaneValue, () => diagnosticsPane({ context })),
    Match.exhaustive
  )
