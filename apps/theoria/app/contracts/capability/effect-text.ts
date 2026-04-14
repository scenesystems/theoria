import * as Arr from "effect/Array"

import type { Obstacle } from "../obstacle.js"
import { semanticsFor } from "../presentation/text.js"

// ---------------------------------------------------------------------------
// Surface geometry — shared between surviving browser text owners
// ---------------------------------------------------------------------------

const reflowSemantics = semanticsFor("card-summary")

export const projectionStepCount = 16

export const stageHorizontalInsetPx = 20
export const stageFrameBorderPx = 1
const stageHorizontalChromePx = (stageHorizontalInsetPx * 2) + (stageFrameBorderPx * 2)

export const obstacleGapPx = 16
export const obstacleSafeMinWidthPx = 250
export const obstacleSafeMinRailPx = 128

export const stageSliderMaxWidth: number = reflowSemantics.maxWidth.compact

const minWidthForSceneObstacles = (sceneObstacles: ReadonlyArray<Obstacle>): number =>
  Arr.reduce(
    sceneObstacles,
    obstacleSafeMinWidthPx,
    (minWidth, obstacle) => Math.max(minWidth, obstacle.widthPx + obstacleGapPx + obstacleSafeMinRailPx)
  )

export const projectionMinWidthFor = (
  stageMaxWidth: number,
  obstaclesEnabled = false,
  sceneObstacles: ReadonlyArray<Obstacle> = []
): number =>
  Math.min(
    obstaclesEnabled
      ? Math.max(Math.round(stageSliderMaxWidth / 4), minWidthForSceneObstacles(sceneObstacles))
      : Math.round(stageSliderMaxWidth / 4),
    stageMaxWidth
  )

export const resolveStageMaxWidth = (viewportWidthPx: number): number =>
  viewportWidthPx > 0
    ? Math.min(stageSliderMaxWidth, Math.max(1, viewportWidthPx - stageHorizontalChromePx))
    : stageSliderMaxWidth

export const resolveStageWidth = (
  requestedWidthPx: number,
  viewportWidthPx: number,
  obstaclesEnabled = false,
  sceneObstacles: ReadonlyArray<Obstacle> = []
): number => {
  const stageMaxWidth = resolveStageMaxWidth(viewportWidthPx)

  return Math.min(
    stageMaxWidth,
    Math.max(projectionMinWidthFor(stageMaxWidth, obstaclesEnabled, sceneObstacles), requestedWidthPx)
  )
}

export const partitionProjectionWidths = (
  minPx: number,
  maxPx: number,
  count: number = projectionStepCount
): ReadonlyArray<number> => {
  const clamped = Math.max(minPx, Math.min(minPx, maxPx))
  const range = Math.max(0, maxPx - clamped)
  const step = count > 1 ? range / (count - 1) : 0

  return Arr.makeBy(count, (i) => Math.round(clamped + step * i))
}
