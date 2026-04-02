import { DeepDivePanePercentMax, DeepDivePanePercentMin } from "../../../contracts/layout.js"

import { SplitPane } from "../containers/SplitPane.js"
import { Layer } from "../primitives/Layout.js"

import { type DeepDiveProjectionModel, projectedProjectionSurfaces } from "./projection-model.js"
import {
  clampedThreePanePrimaryPercent,
  clampedThreePaneSecondaryPercent,
  threePanePrimaryBounds,
  threePaneSecondaryBounds
} from "./projection-workspace-layout.js"

const workspaceFieldClassName = "min-h-0 h-full flex flex-1 flex-col bg-stage-200/72"
const focusedProjectedSurfaceIndex = (projection: DeepDiveProjectionModel): number => {
  const projected = projectedProjectionSurfaces(projection.surfaces)
  const resolvedIndex = projected.findIndex((surface) => surface.id === projection.focusedSurface)

  return resolvedIndex === -1 ? 0 : resolvedIndex
}

export const ProjectionWorkspace = ({
  dividerClassName,
  handleClassName,
  onFirstPanePercentChange,
  onSecondPanePercentChange,
  projection
}: {
  readonly dividerClassName: string
  readonly handleClassName: string
  readonly onFirstPanePercentChange: (percent: number) => void
  readonly onSecondPanePercentChange: (percent: number) => void
  readonly projection: DeepDiveProjectionModel
}) => {
  const projected = projectedProjectionSurfaces(projection.surfaces)
  const focusedIndex = focusedProjectedSurfaceIndex(projection)
  const threePanePrimaryPercent = clampedThreePanePrimaryPercent(projection.panePercent)
  const threePaneSecondaryPercent = clampedThreePaneSecondaryPercent({
    primaryPercent: threePanePrimaryPercent,
    secondaryPercent: projection.secondaryPanePercent
  })
  const trailingSplitBounds = threePaneSecondaryBounds(threePanePrimaryPercent)

  if (projected.length === 0) {
    return null
  }

  if (projected.length === 1) {
    return <Layer className={workspaceFieldClassName}>{projected[0]!.pane}</Layer>
  }

  if (projected.length === 2) {
    return (
      <Layer className={workspaceFieldClassName}>
        <SplitPane
          ariaLabel="Resize projected surface panes"
          compactActivePane={focusedIndex === 1 ? "second" : "first"}
          dividerClassName={dividerClassName}
          first={projected[0]!.pane}
          firstPanePercent={projection.panePercent}
          handleClassName={handleClassName}
          maxPercent={DeepDivePanePercentMax}
          minPercent={DeepDivePanePercentMin}
          onFirstPanePercentChange={onFirstPanePercentChange}
          second={projected[1]!.pane}
          secondPaneVisible
        />
      </Layer>
    )
  }

  return (
    <Layer className={workspaceFieldClassName}>
      <SplitPane
        ariaLabel="Resize projected surface field"
        compactActivePane={focusedIndex === 0 ? "first" : "second"}
        dividerClassName={dividerClassName}
        first={projected[0]!.pane}
        firstPanePercent={threePanePrimaryPercent}
        handleClassName={handleClassName}
        maxPercent={threePanePrimaryBounds.maxPercent}
        minPercent={threePanePrimaryBounds.minPercent}
        onFirstPanePercentChange={onFirstPanePercentChange}
        second={
          <SplitPane
            ariaLabel="Resize trailing projected surface panes"
            compactActivePane={focusedIndex === 2 ? "second" : "first"}
            dividerClassName={dividerClassName}
            first={projected[1]!.pane}
            firstPanePercent={threePaneSecondaryPercent}
            handleClassName={handleClassName}
            maxPercent={trailingSplitBounds.maxPercent}
            minPercent={trailingSplitBounds.minPercent}
            onFirstPanePercentChange={onSecondPanePercentChange}
            second={projected[2]!.pane}
            secondPaneVisible
          />
        }
        secondPaneVisible
      />
    </Layer>
  )
}
