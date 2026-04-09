import { Option, Order } from "effect"
import { Text } from "effect-text"
import type { PreparedTextWithSegments } from "effect-text/Text"
import * as Arr from "effect/Array"

import type { Obstacle } from "../../contracts/obstacle.js"
import {
  availableWidthForLine,
  lineInsetsFor,
  type ObstacleProjection,
  type ReflowStageLine,
  type ReflowStageObstacle,
  resolveStageObstacles,
  summaryFromLines
} from "./obstacleStageModel.js"

const obstacleBottomOrder = Order.mapInput(
  Order.number,
  (obstacle: { readonly topPx: number; readonly heightPx: number }) => obstacle.topPx + obstacle.heightPx
)

const projectedLinesFor = (
  prepared: PreparedTextWithSegments,
  request: Text.LayoutRequestType,
  stageObstacles: ReadonlyArray<ReflowStageObstacle>
): ReadonlyArray<ReflowStageLine> =>
  Arr.map(
    Text.layoutLinesWith(
      prepared,
      request,
      (lineIndex) => availableWidthForLine(lineIndex, request.maxWidth, request.lineHeight, stageObstacles)
    ),
    (line) => {
      const insets = lineInsetsFor(line.index, request.lineHeight, stageObstacles)

      return {
        ...line,
        leftInsetPx: insets.leftInsetPx,
        rightInsetPx: insets.rightInsetPx,
        availableWidthPx: availableWidthForLine(line.index, request.maxWidth, request.lineHeight, stageObstacles)
      }
    }
  )

export const projectObstacleTextLayout = ({
  baselineSummary,
  obstacles,
  prepared,
  request
}: {
  readonly baselineSummary: Text.LayoutSummaryType
  readonly obstacles: ReadonlyArray<Obstacle>
  readonly prepared: PreparedTextWithSegments
  readonly request: Text.LayoutRequestType
}): ObstacleProjection => {
  const stageObstacles = resolveStageObstacles(request, obstacles)
  const lines = projectedLinesFor(prepared, request, stageObstacles)
  const summary = summaryFromLines(lines, request.lineHeight)
  const lowestObstacleBottomPx = Option.getOrElse(
    Arr.last(Arr.sort(stageObstacles, obstacleBottomOrder)),
    () => ({ topPx: 0, heightPx: 0 })
  )
  const canvasHeightPx = Math.max(
    baselineSummary.height,
    summary.height,
    lowestObstacleBottomPx.topPx + lowestObstacleBottomPx.heightPx
  )

  return {
    lines,
    summary,
    effectiveWidthPx: Arr.reduce(
      lines,
      request.maxWidth,
      (minWidth, line) => Math.min(minWidth, line.availableWidthPx)
    ),
    obstacles: stageObstacles,
    canvasHeightPx
  }
}
