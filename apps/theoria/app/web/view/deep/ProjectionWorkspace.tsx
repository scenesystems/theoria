import { Match } from "effect"

import { SplitPane } from "../containers/SplitPane.js"
import { Layer } from "../primitives/Layout.js"

import type { DeepDiveProjectionModel } from "./projection-model.js"

const workspaceFieldClassName = "min-h-0 h-full flex flex-1 flex-col bg-stage-200/72"

const paneForSurface = ({
  projection,
  surfaceId
}: {
  readonly projection: DeepDiveProjectionModel
  readonly surfaceId: DeepDiveProjectionModel["surfaces"][number]["id"]
}) => projection.surfaces.find((surface) => surface.id === surfaceId)?.pane ?? null

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
  const layout = projection.workspaceLayout

  return Match.value(layout).pipe(
    Match.tag("Empty", () => null),
    Match.tag(
      "Single",
      ({ surfaceId }) => <Layer className={workspaceFieldClassName}>{paneForSurface({ projection, surfaceId })}</Layer>
    ),
    Match.tag(
      "Split",
      ({ compactActivePane, firstPanePercent, firstSurfaceId, maxPercent, minPercent, secondSurfaceId }) => (
        <Layer className={workspaceFieldClassName}>
          <SplitPane
            ariaLabel="Resize projected surface panes"
            compactActivePane={compactActivePane}
            dividerClassName={dividerClassName}
            first={paneForSurface({ projection, surfaceId: firstSurfaceId })}
            firstPanePercent={firstPanePercent}
            handleClassName={handleClassName}
            maxPercent={maxPercent}
            minPercent={minPercent}
            onFirstPanePercentChange={onFirstPanePercentChange}
            second={paneForSurface({ projection, surfaceId: secondSurfaceId })}
            secondPaneVisible
          />
        </Layer>
      )
    ),
    Match.tag(
      "Triple",
      ({
        compactActivePane,
        firstPanePercent,
        firstSurfaceId,
        maxPercent,
        minPercent,
        secondCompactActivePane,
        secondFirstPanePercent,
        secondMaxPercent,
        secondMinPercent,
        secondSurfaceId,
        thirdSurfaceId
      }) => (
        <Layer className={workspaceFieldClassName}>
          <SplitPane
            ariaLabel="Resize projected surface field"
            compactActivePane={compactActivePane}
            dividerClassName={dividerClassName}
            first={paneForSurface({ projection, surfaceId: firstSurfaceId })}
            firstPanePercent={firstPanePercent}
            handleClassName={handleClassName}
            maxPercent={maxPercent}
            minPercent={minPercent}
            onFirstPanePercentChange={onFirstPanePercentChange}
            second={
              <SplitPane
                ariaLabel="Resize trailing projected surface panes"
                compactActivePane={secondCompactActivePane}
                dividerClassName={dividerClassName}
                first={paneForSurface({ projection, surfaceId: secondSurfaceId })}
                firstPanePercent={secondFirstPanePercent}
                handleClassName={handleClassName}
                maxPercent={secondMaxPercent}
                minPercent={secondMinPercent}
                onFirstPanePercentChange={onSecondPanePercentChange}
                second={paneForSurface({ projection, surfaceId: thirdSurfaceId })}
                secondPaneVisible
              />
            }
            secondPaneVisible
          />
        </Layer>
      )
    ),
    Match.exhaustive
  )
}
