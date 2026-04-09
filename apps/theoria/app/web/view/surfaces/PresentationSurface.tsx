import * as Option from "effect/Option"

import type { EntryId } from "../../../contracts/entry/id.js"
import { type SurfaceChromeContentModel, surfaceChromeModel } from "../../../contracts/presentation/surface-chrome.js"
import type { RunControlActionKind } from "../../state/run/types.js"

import { useElementWidthReporter } from "../../atoms/surface/element-observation.js"
import { CompactNav } from "../deep/CompactNav.js"
import {
  type DeepDiveProjectionControlModel,
  deepDiveProjectionControlModelFor,
  type DeepDiveProjectionModel
} from "../deep/projection-model.js"
import { ProjectionWorkspace } from "../deep/ProjectionWorkspace.js"
import { Layer, Section } from "../primitives/Layout.js"
import { app, surfaceForCard } from "../primitives/theme/surface.js"
import type { RunControlsViewModel } from "../runControlsModel.js"

export const PresentationSurface = ({
  backHref,
  chromeContent,
  entryId,
  onFocusSurface,
  onHideSurface,
  onPanePercentChange,
  onRunControlAction,
  onSecondaryPanePercentChange,
  onProjectSurface,
  onWorkspaceWidthChange,
  projection,
  runControls
}: {
  readonly backHref: string | undefined
  readonly chromeContent: SurfaceChromeContentModel
  readonly entryId: EntryId
  readonly onFocusSurface: (surface: DeepDiveProjectionControlModel["focusedSurface"]) => void
  readonly onHideSurface: (surface: DeepDiveProjectionControlModel["focusedSurface"]) => void
  readonly onPanePercentChange: (nextPercent: number) => void
  readonly onRunControlAction: (action: RunControlActionKind) => void
  readonly onSecondaryPanePercentChange: (nextPercent: number) => void
  readonly onProjectSurface: (surface: DeepDiveProjectionControlModel["focusedSurface"], index?: number) => void
  readonly onWorkspaceWidthChange: (workspaceWidth: number) => void
  readonly projection: DeepDiveProjectionModel
  readonly runControls: RunControlsViewModel
}) => {
  const theme = surfaceForCard(entryId)
  const observeProjectionWorkspace = useElementWidthReporter(onWorkspaceWidthChange)
  const projectionControlModel = deepDiveProjectionControlModelFor(projection)

  const chrome = surfaceChromeModel({
    backHref: Option.fromNullable(backHref),
    content: chromeContent,
    deepDiveHref: Option.none()
  })

  return (
    <Layer className="relative flex h-dvh flex-col overflow-hidden bg-stage-50 text-ink-900 antialiased">
      <Layer className={app.atmosphericGlowA} />
      <Layer className={app.atmosphericGlowB} />
      <CompactNav
        entryId={entryId}
        chrome={chrome}
        onRunControlAction={onRunControlAction}
        projection={{
          model: projectionControlModel,
          onFocusSurface,
          onHideSurface,
          onProjectSurface
        }}
        runControls={runControls}
        theme={theme}
      />
      <Section className="relative min-h-0 flex-1" ref={observeProjectionWorkspace}>
        <ProjectionWorkspace
          dividerClassName={theme.splitDivider}
          handleClassName={theme.splitHandle}
          onFirstPanePercentChange={(nextPercent) => {
            onPanePercentChange(nextPercent)
          }}
          onSecondPanePercentChange={(nextPercent) => {
            onSecondaryPanePercentChange(nextPercent)
          }}
          projection={projection}
        />
      </Section>
    </Layer>
  )
}
