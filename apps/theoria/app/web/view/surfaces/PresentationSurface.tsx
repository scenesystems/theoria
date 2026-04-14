import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"
import * as Option from "effect/Option"
import type { PointerEvent, ReactNode } from "react"
import { useRef } from "react"

import type { EntryId } from "../../../contracts/entry/id.js"
import { isWorkflowEntryId } from "../../../contracts/entry/id.js"
import type { ProgramSourceScope } from "../../../contracts/presentation/program.js"
import {
  projectedSurfaces,
  type ProjectionModel,
  type ProjectionPlane
} from "../../../contracts/presentation/projection.js"
import type { RunEvidenceBannerTone, RunEvidenceViewModel } from "../../../contracts/presentation/run-evidence.js"
import type { RunRuntimeTelemetryViewModel } from "../../../contracts/presentation/run-runtime-telemetry.js"
import { surfaceChromeModel } from "../../../contracts/presentation/surface-chrome.js"
import type { SurfaceViewModel } from "../../../contracts/presentation/surface-presentation.js"
import { projectionPanePercentAtom, setProjectionPanePercentAtom } from "../../atoms/surface/projection.js"
import type { RunControlActionKind } from "../../state/run/types.js"

import { CompactNav } from "../primitives/CompactNav.js"
import { EvidenceRows } from "../primitives/EvidenceRows.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { ProgramCodeWorkspace } from "../primitives/ProgramCodeWorkspace.js"
import { ProjectionMenuTrigger, ProjectionPanel } from "../primitives/ProjectionMenu.js"
import { RunLifecycleDiagnosticsPanel } from "../primitives/RunLifecycleDiagnosticsPanel.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { SurfacePlaneFrame } from "../primitives/SurfacePlaneFrame.js"
import { SurfaceStatus } from "../primitives/SurfaceStatus.js"
import { SurfaceViewport } from "../primitives/SurfaceViewport.js"
import { TabBar, TabButton } from "../primitives/TabBar.js"
import { app, type Surface, surfaceForCard, surfaceMaterials } from "../primitives/theme/surface.js"
import { OpenAgentTracePanel } from "../study/open-agent-trace/OpenAgentTracePanel.js"
import { WorkflowStageWorkspace, workflowStageWorkspaceSummaryText } from "../study/workflow/WorkflowStageWorkspace.js"

const variant = "expanded"

type PaneEmphasis = "primary" | "secondary"

const evidenceBannerClassName = (tone: RunEvidenceBannerTone): string =>
  tone === "error" ? surfaceMaterials.calloutError : surfaceMaterials.callout

const paneSurfaceClassName = ({
  emphasis,
  theme
}: {
  readonly emphasis: PaneEmphasis
  readonly theme: Surface
}): string => emphasis === "primary" ? theme.panel : theme.supportPanel

const splitDividerClassName =
  "relative hidden w-1.5 shrink-0 cursor-col-resize select-none bg-stage-200/90 transition-colors duration-100 hover:bg-stage-300/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-0 xl:block"

const splitHandleClassName =
  "after:absolute after:left-1/2 after:top-1/2 after:h-14 after:w-2 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border after:border-stage-300 after:bg-stage-0/96 after:shadow-chip"

const SplitHandle = ({
  onPanePercentChange
}: {
  readonly onPanePercentChange: (percent: number) => void
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return

    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = true
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return

    const container = containerRef.current?.parentElement

    if (container === null || container === undefined) return

    const rect = container.getBoundingClientRect()
    const percent = ((event.clientX - rect.left) / rect.width) * 100
    onPanePercentChange(percent)
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return

    event.currentTarget.releasePointerCapture(event.pointerId)
    draggingRef.current = false
  }

  return (
    <Layer
      ref={containerRef}
      aria-hidden
      className={`${splitDividerClassName} ${splitHandleClassName}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  )
}

const renderSourcePane = ({
  code,
  emphasis,
  onSelectFile,
  onSelectSourceScope,
  theme
}: {
  readonly code: SurfaceViewModel["code"]
  readonly emphasis: PaneEmphasis
  readonly onSelectFile: (index: number) => void
  readonly onSelectSourceScope: (scope: ProgramSourceScope) => void
  readonly theme: Surface
}): ReactNode => (
  <SurfacePlaneFrame
    className={`${paneSurfaceClassName({ emphasis, theme })} overflow-hidden`}
    contentClassName="min-h-0 flex-1 overflow-hidden"
    hintText={code.hint}
    meta={code.sourceTabs.length > 1
      ? (
        <TabBar appearance="flat">
          {code.sourceTabs.map((tab) => (
            <TabButton
              active={tab.scope === code.selectedSourceScope}
              appearance="flat"
              key={tab.scope}
              label={tab.label}
              onClick={() => {
                onSelectSourceScope(tab.scope)
              }}
            />
          ))}
        </TabBar>
      )
      : undefined}
    summaryText={code.originHint}
    title="Source"
    variant={variant}
  >
    <ProgramCodeWorkspace
      codeClassName={theme.codePanel.codeContainer}
      codePanel={theme.codePanel}
      entry={code.entry}
      fileName={code.fileName}
      filesVisible
      fileTabs={code.fileTabs}
      onSelectFile={onSelectFile}
      selectedFileIndex={code.selectedFileIndex}
      source={code.source}
      variant={variant}
    />
  </SurfacePlaneFrame>
)

const renderEvidencePane = ({
  diagnostics,
  evidence,
  emphasis,
  model,
  theme
}: {
  readonly diagnostics: RunRuntimeTelemetryViewModel | null
  readonly evidence: RunEvidenceViewModel
  readonly emphasis: PaneEmphasis
  readonly model: SurfaceViewModel
  readonly theme: Surface
}): ReactNode => (
  <Stack className="min-h-0 flex-1 gap-0 divide-y divide-stage-200/82">
    <SurfacePlaneFrame
      className={paneSurfaceClassName({ emphasis, theme })}
      summaryText={evidence.description}
      title="Evidence"
      variant={variant}
    >
      <Stack className="gap-4">
        {Match.value(evidence.banner).pipe(
          Match.when(null, () => null),
          Match.orElse((banner) => (
            <Layer className={evidenceBannerClassName(banner.tone)}>
              <SemanticText
                as="p"
                className="text-ink-900"
                role="status"
                text={banner.text}
                variant={variant}
              />
            </Layer>
          ))
        )}
        <EvidenceRows density={model.evidenceDensity} rows={model.evidenceRows} variant={variant} />
      </Stack>
    </SurfacePlaneFrame>

    {diagnostics === null
      ? null
      : (
        <SurfacePlaneFrame
          className={paneSurfaceClassName({ emphasis, theme })}
          summaryText="Execution notes, timing, and lifecycle details for the current study run."
          title="Diagnostics"
          variant={variant}
        >
          <RunLifecycleDiagnosticsPanel sections={diagnostics.sections} />
        </SurfacePlaneFrame>
      )}
  </Stack>
)

const renderStagePane = ({
  diagnostics,
  entryId,
  emphasis,
  model,
  theme
}: {
  readonly diagnostics: RunRuntimeTelemetryViewModel | null
  readonly entryId: EntryId
  readonly emphasis: PaneEmphasis
  readonly model: SurfaceViewModel
  readonly theme: Surface
}): ReactNode => (
  <SurfacePlaneFrame
    className={paneSurfaceClassName({ emphasis, theme })}
    summaryText={workflowStageWorkspaceSummaryText(model)}
    title={model.surfaceStage.interactiveLabel ?? "Study"}
    variant={variant}
  >
    <WorkflowStageWorkspace diagnostics={diagnostics} entryId={entryId} model={model} />
  </SurfacePlaneFrame>
)

const renderInteractionPane = ({
  emphasis,
  theme
}: {
  readonly emphasis: PaneEmphasis
  readonly theme: Surface
}): ReactNode => (
  <SurfacePlaneFrame
    className={paneSurfaceClassName({ emphasis, theme })}
    summaryText="Inspect imported traces, interaction turns, and workflow handoffs alongside the active study."
    title="Interaction"
    variant={variant}
  >
    <OpenAgentTracePanel />
  </SurfacePlaneFrame>
)

const renderDiagnosticsPane = ({
  diagnostics,
  emphasis,
  theme
}: {
  readonly diagnostics: RunRuntimeTelemetryViewModel | null
  readonly emphasis: PaneEmphasis
  readonly theme: Surface
}): ReactNode =>
  diagnostics === null
    ? null
    : (
      <SurfacePlaneFrame
        className={paneSurfaceClassName({ emphasis, theme })}
        summaryText="Execution notes, timing, and lifecycle details for the current study run."
        title="Diagnostics"
        variant={variant}
      >
        <RunLifecycleDiagnosticsPanel sections={diagnostics.sections} />
      </SurfacePlaneFrame>
    )

type RenderProjectionContext = {
  readonly entryId: EntryId
  readonly diagnostics: RunRuntimeTelemetryViewModel | null
  readonly emphasis: PaneEmphasis
  readonly model: SurfaceViewModel
  readonly onSelectFile: (index: number) => void
  readonly onSelectSourceScope: (scope: ProgramSourceScope) => void
  readonly theme: Surface
  readonly workflowEntry: boolean
}

const renderProjectionPane = (
  plane: ProjectionPlane,
  context: RenderProjectionContext
): ReactNode =>
  Match.value(plane).pipe(
    Match.when("source", () =>
      renderSourcePane({
        code: context.model.code,
        emphasis: context.emphasis,
        onSelectFile: context.onSelectFile,
        onSelectSourceScope: context.onSelectSourceScope,
        theme: context.theme
      })),
    Match.when("evidence", () =>
      renderEvidencePane({
        diagnostics: context.diagnostics,
        evidence: context.model.surfaceStage.evidence,
        emphasis: context.emphasis,
        model: context.model,
        theme: context.theme
      })),
    Match.when("stage", () =>
      context.workflowEntry
        ? renderStagePane({
          diagnostics: context.diagnostics,
          entryId: context.entryId,
          emphasis: context.emphasis,
          model: context.model,
          theme: context.theme
        })
        : null),
    Match.when("interaction", () =>
      context.workflowEntry
        ? renderInteractionPane({ emphasis: context.emphasis, theme: context.theme })
        : null),
    Match.when("diagnostics", () =>
      renderDiagnosticsPane({ diagnostics: context.diagnostics, emphasis: context.emphasis, theme: context.theme })),
    Match.exhaustive
  )

export const PresentationSurface = ({
  backHref,
  diagnostics,
  entryId,
  model,
  onFocusSurface,
  onHideSurface,
  onProjectSurface,
  onReorderSurface,
  onRunControlAction,
  onSelectFile,
  onSelectSourceScope,
  projection
}: {
  readonly backHref: string | undefined
  readonly diagnostics: RunRuntimeTelemetryViewModel | null
  readonly entryId: EntryId
  readonly model: SurfaceViewModel
  readonly onFocusSurface: (plane: ProjectionPlane) => void
  readonly onHideSurface: (plane: ProjectionPlane) => void
  readonly onProjectSurface: (plane: ProjectionPlane) => void
  readonly onReorderSurface: (plane: ProjectionPlane, index: number) => void
  readonly onRunControlAction: (action: RunControlActionKind) => void
  readonly onSelectFile: (index: number) => void
  readonly onSelectSourceScope: (scope: ProgramSourceScope) => void
  readonly projection: ProjectionModel
}) => {
  const theme = surfaceForCard(entryId)
  const workflowEntry = isWorkflowEntryId(entryId)
  const panePercent = useAtomValue(projectionPanePercentAtom)
  const setPanePercent = useAtomSet(setProjectionPanePercentAtom)

  const chrome = surfaceChromeModel({
    backHref: Option.fromNullable(backHref),
    content: model.chrome
  })

  const projected = projectedSurfaces(projection.surfaces)
  const renderContext: RenderProjectionContext = {
    entryId,
    diagnostics,
    emphasis: "primary",
    model,
    onSelectFile,
    onSelectSourceScope,
    theme,
    workflowEntry
  }

  const firstPane = projected[0] ?? null
  const secondPane = projected[1] ?? null
  const isSplit = firstPane !== null && secondPane !== null

  return (
    <Layer className="relative flex min-h-dvh flex-col overflow-x-hidden bg-stage-50 text-ink-900 antialiased">
      <Layer className={app.atmosphericGlowA} />
      <Layer className={app.atmosphericGlowB} />
      <CompactNav
        chrome={chrome}
        controls={model.runControls}
        onRunControlAction={onRunControlAction}
        projectionMenu={<ProjectionMenuTrigger max={projection.maxProjectedCount} projected={projected.length} />}
        theme={theme}
      />
      <SurfaceViewport className="relative flex min-h-0 flex-1 flex-col">
        <SurfaceStatus status={model.status} theme={theme} tone={model.statusTone} variant={variant} />

        <Layer className="flex min-h-0 flex-1 flex-col border-y border-stage-200/82 xl:flex-row">
          {isSplit
            ? (
              <>
                <Stack
                  className="min-h-0 min-w-0 flex-1 xl:flex-none"
                  style={{ flexBasis: `${panePercent}%` }}
                >
                  {renderProjectionPane(firstPane.id, { ...renderContext, emphasis: "primary" })}
                </Stack>
                <SplitHandle onPanePercentChange={setPanePercent} />
                <Stack className="min-h-0 min-w-0 flex-1">
                  {renderProjectionPane(secondPane.id, { ...renderContext, emphasis: "secondary" })}
                </Stack>
              </>
            )
            : projected.map((surface) => (
              <Stack key={surface.id} className="min-h-0 flex-1">
                {renderProjectionPane(surface.id, renderContext)}
              </Stack>
            ))}
        </Layer>
      </SurfaceViewport>

      <ProjectionPanel
        onFocusSurface={onFocusSurface}
        onHideSurface={onHideSurface}
        onProjectSurface={onProjectSurface}
        onReorderSurface={onReorderSurface}
        projection={projection}
      />
    </Layer>
  )
}
