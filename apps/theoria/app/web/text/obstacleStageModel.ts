import type { Text } from "effect-text"
import * as Arr from "effect/Array"

import { obstacleGapPx } from "../../contracts/demo/text.js"
import type { Obstacle } from "../../contracts/obstacle.js"

export const reflowObstacleGapPx = obstacleGapPx

export type ReflowStageObstacle = Obstacle & {
  readonly occupiedWidthPx: number
  readonly lineStart: number
  readonly lineSpan: number
}

export type ReflowStageLine = Text.LayoutLineType & {
  readonly leftInsetPx: number
  readonly rightInsetPx: number
  readonly availableWidthPx: number
}

export type ObstacleProjection = {
  readonly lines: ReadonlyArray<ReflowStageLine>
  readonly summary: Text.LayoutSummaryType
  readonly effectiveWidthPx: number
  readonly obstacles: ReadonlyArray<ReflowStageObstacle>
  readonly canvasHeightPx: number
}

const lineStartFor = (obstacle: Obstacle, lineHeight: number): number => Math.floor(obstacle.topPx / lineHeight)

const lineEndExclusiveFor = (obstacle: Obstacle, lineHeight: number): number =>
  Math.max(lineStartFor(obstacle, lineHeight) + 1, Math.ceil((obstacle.topPx + obstacle.heightPx) / lineHeight))

const lineSpanFor = (obstacle: Obstacle, lineHeight: number): number =>
  lineEndExclusiveFor(obstacle, lineHeight) - lineStartFor(obstacle, lineHeight)

const activeOnLine = (lineIndex: number, lineHeight: number, obstacle: ReflowStageObstacle): boolean => {
  const lineTopPx = lineIndex * lineHeight
  const lineBottomPx = lineTopPx + lineHeight
  const obstacleBottomPx = obstacle.topPx + obstacle.heightPx

  return obstacle.topPx < lineBottomPx && obstacleBottomPx > lineTopPx
}

export const activeStageObstaclesOnLine = (
  lineIndex: number,
  lineHeight: number,
  obstacles: ReadonlyArray<ReflowStageObstacle>
): ReadonlyArray<ReflowStageObstacle> =>
  Arr.filter(obstacles, (obstacle) => activeOnLine(lineIndex, lineHeight, obstacle))

export const resolveStageObstacles = (
  request: Text.LayoutRequestType,
  obstacles: ReadonlyArray<Obstacle>
): ReadonlyArray<ReflowStageObstacle> =>
  Arr.map(obstacles, (obstacle) => ({
    ...obstacle,
    occupiedWidthPx: obstacle.widthPx + reflowObstacleGapPx,
    lineStart: lineStartFor(obstacle, request.lineHeight),
    lineSpan: lineSpanFor(obstacle, request.lineHeight)
  }))

export const lineInsetsFor = (
  lineIndex: number,
  lineHeight: number,
  obstacles: ReadonlyArray<ReflowStageObstacle>
): { readonly leftInsetPx: number; readonly rightInsetPx: number } =>
  Arr.reduce(
    obstacles,
    { leftInsetPx: 0, rightInsetPx: 0 },
    (acc, obstacle) =>
      activeOnLine(lineIndex, lineHeight, obstacle)
        ? obstacle.placement === "left"
          ? { ...acc, leftInsetPx: acc.leftInsetPx + obstacle.occupiedWidthPx }
          : { ...acc, rightInsetPx: acc.rightInsetPx + obstacle.occupiedWidthPx }
        : acc
  )

export const availableWidthForLine = (
  lineIndex: number,
  maxWidth: number,
  lineHeight: number,
  obstacles: ReadonlyArray<ReflowStageObstacle>
): number => {
  const insets = lineInsetsFor(lineIndex, lineHeight, obstacles)
  return Math.max(0, maxWidth - insets.leftInsetPx - insets.rightInsetPx)
}

export const summaryFromLines = (
  lines: ReadonlyArray<ReflowStageLine>,
  lineHeight: number
): Text.LayoutSummaryType => ({
  lineCount: lines.length,
  height: lines.length * lineHeight,
  maxLineWidth: Arr.reduce(lines, 0, (maxWidth, line) => Math.max(maxWidth, line.width))
})
