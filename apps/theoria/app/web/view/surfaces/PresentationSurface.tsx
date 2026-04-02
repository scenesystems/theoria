import * as Option from "effect/Option"

import type { Card } from "../../../contracts/card.js"
import type { RunControlActionKind } from "../../state/types.js"

import { useElementWidthReporter } from "../../atoms/element-observation.js"
import { CompactNav } from "../deep/CompactNav.js"
import type { DeepDiveProjectionControlModel, DeepDiveProjectionModel } from "../deep/projection-model.js"
import { ProjectionWorkspace } from "../deep/ProjectionWorkspace.js"
import { appTheme, surfaceThemeForCard } from "../primitives/designSystem.js"
import { Layer, Section } from "../primitives/Layout.js"
import type { RunControlsViewModel } from "../runControlsModel.js"
import { type SurfaceChromeContentModel, surfaceChromeModel } from "../surfaceChromeModel.js"

export const PresentationSurface = ({
  backHref,
  card,
  chromeContent,
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
  readonly card: Card
  readonly chromeContent: SurfaceChromeContentModel
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
  const theme = surfaceThemeForCard(card.id)
  const observeProjectionWorkspace = useElementWidthReporter(onWorkspaceWidthChange)
  const projectionControlModel: DeepDiveProjectionControlModel = {
    focusedSurface: projection.focusedSurface,
    maxProjectedCount: projection.maxProjectedCount,
    surfaces: projection.surfaces.map(({ pane: _pane, ...surface }) => surface)
  }

  const chrome = surfaceChromeModel({
    backHref: Option.fromNullable(backHref),
    content: chromeContent,
    deepDiveHref: Option.none()
  })

  return (
    <Layer className="relative flex h-dvh flex-col overflow-hidden bg-stage-50 text-ink-900 antialiased">
      <Layer className={appTheme.atmosphericGlowA} />
      <Layer className={appTheme.atmosphericGlowB} />
      <CompactNav
        cardId={card.id}
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
