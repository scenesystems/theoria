import type { EntryId } from "../../../contracts/entry/id.js"
import type { DeepDiveProjectionControlModel } from "../../../contracts/presentation/deep-dive-projection.js"
import type { RunControlsViewModel } from "../../../contracts/presentation/run-controls.js"
import type { SurfaceChromeModel } from "../../../contracts/presentation/surface-chrome.js"
import type { RunControlActionKind } from "../../state/run/types.js"

import { ActionLink } from "../primitives/ActionControl.js"
import { Cluster, Header, Layer } from "../primitives/Layout.js"
import { PackageBadge } from "../primitives/PackageBadge.js"
import { RunControlDock } from "../primitives/RunControlDock.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { neutralBadge } from "../primitives/theme/badge.js"
import { app, type Surface } from "../primitives/theme/surface.js"
import { toneForCard } from "../primitives/theme/tone.js"
import { ThemeToggle } from "../primitives/ThemeToggle.js"
import { TheoriaLogo } from "../primitives/TheoriaLogo.js"

import { ProjectionMenu } from "./ProjectionMenu.js"

export const CompactNav = ({
  entryId,
  chrome,
  onRunControlAction,
  projection,
  runControls,
  theme
}: {
  readonly entryId: EntryId
  readonly chrome: SurfaceChromeModel
  readonly onRunControlAction: (action: RunControlActionKind) => void
  readonly projection?: {
    readonly model: DeepDiveProjectionControlModel
    readonly onFocusSurface: (surface: DeepDiveProjectionControlModel["focusedSurface"]) => void
    readonly onHideSurface: (surface: DeepDiveProjectionControlModel["focusedSurface"]) => void
    readonly onProjectSurface: (surface: DeepDiveProjectionControlModel["focusedSurface"], index?: number) => void
  }
  readonly runControls: RunControlsViewModel
  readonly theme: Surface
}) => {
  const tone = toneForCard(entryId)
  const backControl = chrome.backLink.href === null
    ? null
    : (
      <ActionLink
        className={theme.backAction}
        href={chrome.backLink.href}
        label={`← ${chrome.backLink.label}`}
        variant="compact"
      />
    )

  const utilityControls = (
    <Cluster className="items-center gap-2 sm:gap-3">
      {projection !== undefined
        ? (
          <ProjectionMenu
            onFocusSurface={projection.onFocusSurface}
            onHideSurface={projection.onHideSurface}
            onProjectSurface={projection.onProjectSurface}
            projection={projection.model}
          />
        )
        : chrome.runtimeBadge.visible
        ? (
          <PackageBadge
            badge={neutralBadge}
            label={chrome.runtimeBadge.label}
            variant="compact"
          />
        )
        : null}
      {chrome.themeControl.visible ? <ThemeToggle /> : null}
    </Cluster>
  )

  const brandRow = (
    <Cluster className="min-w-0 flex-nowrap items-center gap-2 sm:gap-3">
      <TheoriaLogo className="shrink-0 text-base sm:text-lg" />
      <Layer aria-hidden className={`hidden h-6 w-px shrink-0 sm:block ${tone.bg}`} />
      <SemanticText
        as="h1"
        className="min-w-0 truncate text-ink-900"
        role="hero-body"
        text={chrome.title}
        variant="compact"
      />
    </Cluster>
  )

  return (
    <Header className={`${app.compactNav} relative z-20`}>
      <Layer className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4">
        <Cluster className="min-w-0 items-center gap-3 sm:gap-4 sm:justify-self-start">
          <Layer className="shrink-0">{backControl}</Layer>
          {brandRow}
        </Cluster>

        <Layer className="min-w-0 shrink-0 justify-self-end sm:col-start-3 sm:row-start-1">{utilityControls}</Layer>

        <Layer className="col-span-2 flex min-w-0 justify-center sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:justify-self-center">
          <RunControlDock
            controls={runControls}
            onRunControlAction={onRunControlAction}
            theme={theme}
            variant="compact"
          />
        </Layer>
      </Layer>
    </Header>
  )
}
