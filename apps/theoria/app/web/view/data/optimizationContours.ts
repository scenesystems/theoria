import { Match } from "effect"
import * as Arr from "effect/Array"

import { objectiveAt, optimum, searchBounds } from "../../../contracts/demo/objective.js"

export type Segment = {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
}

export const OPTIMIZATION_SVG = {
  width: 480,
  height: 320,
  padding: { left: 6, right: 6, top: 6, bottom: 6 }
}

const PLOT_WIDTH = OPTIMIZATION_SVG.width - OPTIMIZATION_SVG.padding.left - OPTIMIZATION_SVG.padding.right
const PLOT_HEIGHT = OPTIMIZATION_SVG.height - OPTIMIZATION_SVG.padding.top - OPTIMIZATION_SVG.padding.bottom
const RANGE_X = searchBounds.xMax - searchBounds.xMin
const RANGE_Y = searchBounds.yMax - searchBounds.yMin
const GRID_RESOLUTION = 60

export const mapOptimizationX = (x: number): number =>
  OPTIMIZATION_SVG.padding.left + ((x - searchBounds.xMin) / RANGE_X) * PLOT_WIDTH

export const mapOptimizationY = (y: number): number =>
  OPTIMIZATION_SVG.padding.top + ((searchBounds.yMax - y) / RANGE_Y) * PLOT_HEIGHT

const interpolate = (level: number, start: number, end: number): number => {
  const delta = end - start
  return Math.abs(delta) < 1e-12 ? 0.5 : (level - start) / delta
}

const grid = Arr.map(Arr.range(0, GRID_RESOLUTION), (iy) =>
  Arr.map(Arr.range(0, GRID_RESOLUTION), (ix) => {
    const x = searchBounds.xMin + (ix / GRID_RESOLUTION) * RANGE_X
    const y = searchBounds.yMax - (iy / GRID_RESOLUTION) * RANGE_Y
    return objectiveAt({ x, y })
  }))

const segment = (
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number }
): Segment => ({ x1: start.x, y1: start.y, x2: end.x, y2: end.y })

const segmentsForCode = ({
  bottom,
  code,
  left,
  right,
  top
}: {
  readonly bottom: { readonly x: number; readonly y: number }
  readonly code: number
  readonly left: { readonly x: number; readonly y: number }
  readonly right: { readonly x: number; readonly y: number }
  readonly top: { readonly x: number; readonly y: number }
}): ReadonlyArray<Segment> =>
  Match.value(code).pipe(
    Match.when(1, () => [segment(left, bottom)]),
    Match.when(2, () => [segment(bottom, right)]),
    Match.when(3, () => [segment(left, right)]),
    Match.when(4, () => [segment(top, right)]),
    Match.when(5, () => [segment(top, left), segment(bottom, right)]),
    Match.when(6, () => [segment(top, bottom)]),
    Match.when(7, () => [segment(top, left)]),
    Match.when(8, () => [segment(top, left)]),
    Match.when(9, () => [segment(top, bottom)]),
    Match.when(10, () => [segment(top, right), segment(left, bottom)]),
    Match.when(11, () => [segment(top, right)]),
    Match.when(12, () => [segment(left, right)]),
    Match.when(13, () => [segment(bottom, right)]),
    Match.when(14, () => [segment(left, bottom)]),
    Match.orElse(() => [])
  )

const contourSegments = (level: number): ReadonlyArray<Segment> => {
  const cellWidth = PLOT_WIDTH / GRID_RESOLUTION
  const cellHeight = PLOT_HEIGHT / GRID_RESOLUTION

  return Arr.flatMap(Arr.range(0, GRID_RESOLUTION - 1), (iy) =>
    Arr.flatMap(Arr.range(0, GRID_RESOLUTION - 1), (ix) => {
      const topLeft = grid[iy]![ix]!
      const topRight = grid[iy]![ix + 1]!
      const bottomRight = grid[iy + 1]![ix + 1]!
      const bottomLeft = grid[iy + 1]![ix]!
      const x = OPTIMIZATION_SVG.padding.left + ix * cellWidth
      const y = OPTIMIZATION_SVG.padding.top + iy * cellHeight
      const code = (topLeft >= level ? 8 : 0)
        | (topRight >= level ? 4 : 0)
        | (bottomRight >= level ? 2 : 0)
        | (bottomLeft >= level ? 1 : 0)

      return code === 0 || code === 15
        ? []
        : segmentsForCode({
          code,
          top: { x: x + interpolate(level, topLeft, topRight) * cellWidth, y },
          right: { x: x + cellWidth, y: y + interpolate(level, topRight, bottomRight) * cellHeight },
          bottom: { x: x + interpolate(level, bottomLeft, bottomRight) * cellWidth, y: y + cellHeight },
          left: { x, y: y + interpolate(level, topLeft, bottomLeft) * cellHeight }
        })
    }))
}

type ContourLevel = {
  readonly level: number
  readonly color: string
  readonly width: number
  readonly opacity: number
}

const contourLevels: ReadonlyArray<ContourLevel> = [
  { level: 0.5, color: "var(--color-tone-search-500)", width: 1.8, opacity: 0.65 },
  { level: 2, color: "var(--color-tone-search-400)", width: 1.4, opacity: 0.55 },
  { level: 5, color: "var(--color-tone-search-300)", width: 1.1, opacity: 0.45 },
  { level: 10, color: "var(--color-tone-search-200)", width: 0.9, opacity: 0.35 },
  { level: 20, color: "var(--color-tone-search-200)", width: 0.7, opacity: 0.25 },
  { level: 35, color: "var(--color-tone-search-100)", width: 0.6, opacity: 0.2 },
  { level: 50, color: "var(--color-tone-search-100)", width: 0.5, opacity: 0.15 }
]

export const optimizationContourData = Arr.map(contourLevels, ({ level, ...style }) => ({
  ...style,
  level,
  segments: contourSegments(level)
}))

export const optimizationOptimum = {
  x: mapOptimizationX(optimum.x),
  y: mapOptimizationY(optimum.y)
}

export const optimizationPlotBounds = {
  width: PLOT_WIDTH,
  height: PLOT_HEIGHT
}
