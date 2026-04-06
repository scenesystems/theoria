import * as Arr from "effect/Array"

import { normalPdf } from "effect-math/Distribution"

import type { PowerProjection } from "../../atoms/power-animation.js"

export type PlotPoint = {
  readonly x: number
  readonly y: number
}

export const POWER_SVG = {
  width: 480,
  height: 220,
  padding: { left: 6, right: 6, top: 8, bottom: 6 }
}

const PLOT_WIDTH = POWER_SVG.width - POWER_SVG.padding.left - POWER_SVG.padding.right
const PLOT_HEIGHT = POWER_SVG.height - POWER_SVG.padding.top - POWER_SVG.padding.bottom

const mapPowerX = (x: number, xMin: number, xRange: number): number =>
  POWER_SVG.padding.left + ((x - xMin) / xRange) * PLOT_WIDTH

const mapPowerY = (y: number, yMax: number): number => POWER_SVG.padding.top + PLOT_HEIGHT - (y / yMax) * PLOT_HEIGHT

const pathFromPoints = (
  points: ReadonlyArray<PlotPoint>,
  xMin: number,
  xRange: number,
  yMax: number
): string =>
  Arr.join(
    Arr.map(points, ({ x, y }, index) => {
      const scaledX = mapPowerX(x, xMin, xRange)
      const scaledY = mapPowerY(y, yMax)
      return `${index === 0 ? "M" : "L"} ${scaledX.toFixed(1)},${scaledY.toFixed(1)}`
    }),
    " "
  )

const filledRegion = (
  points: ReadonlyArray<PlotPoint>,
  xMin: number,
  xRange: number,
  yMax: number
): string => {
  const line = pathFromPoints(points, xMin, xRange, yMax)
  const baseline = POWER_SVG.padding.top + PLOT_HEIGHT
  const firstX = mapPowerX(points[0]!.x, xMin, xRange)
  const lastX = mapPowerX(points[points.length - 1]!.x, xMin, xRange)
  return `${line} L ${lastX.toFixed(1)},${baseline} L ${firstX.toFixed(1)},${baseline} Z`
}

const samplePdf = (values: ReadonlyArray<number>, mean: number, sigma: number): ReadonlyArray<PlotPoint> =>
  Arr.map(values, (value) => ({ x: value, y: normalPdf(value, mean, sigma) }))

const withinRange = (points: ReadonlyArray<PlotPoint>, from: number, to: number): ReadonlyArray<PlotPoint> =>
  points.filter((point) => point.x >= from && point.x <= to)

const linspace = (min: number, max: number, steps: number): ReadonlyArray<number> => {
  const step = (max - min) / steps
  return Arr.map(Arr.range(0, steps), (index) => min + index * step)
}

export type PowerChartModel = {
  readonly alphaText: string
  readonly baseline: number
  readonly critLeftText: string
  readonly critLeftX: number
  readonly critRightText: string
  readonly critRightX: number
  readonly deltaText: string
  readonly h0Fill: string
  readonly h0Line: string
  readonly h0MeanX: number
  readonly h1Fill: string
  readonly h1Line: string
  readonly h1MeanText: string
  readonly h1MeanX: number
  readonly leftTailFill: string
  readonly powerLeftFill: string
  readonly powerRightFill: string
  readonly rightTailFill: string
}

export const powerChartModel = (projection: PowerProjection): PowerChartModel => {
  const delta = projection.powerReport.noncentrality
  const criticalValue = projection.powerReport.criticalValue
  const xMin = Math.min(-4, -criticalValue - 1.5)
  const xMax = Math.max(4, delta + 4)
  const xRange = xMax - xMin
  const xs = linspace(xMin, xMax, 200)
  const h0Points = samplePdf(xs, 0, 1)
  const h1Points = samplePdf(xs, delta, 1)
  const yMax = Math.max(...h0Points.map((point) => point.y), ...h1Points.map((point) => point.y)) * 1.2

  const h0RightTail = withinRange(h0Points, criticalValue, xMax)
  const h0LeftTail = withinRange(h0Points, xMin, -criticalValue)
  const h1PowerRight = withinRange(h1Points, criticalValue, xMax)
  const h1PowerLeft = withinRange(h1Points, xMin, -criticalValue)

  return {
    alphaText: `α = ${projection.powerReport.alpha.toFixed(2)}`,
    baseline: POWER_SVG.padding.top + PLOT_HEIGHT,
    critLeftText: `t = ${(-criticalValue).toFixed(2)}`,
    critLeftX: mapPowerX(-criticalValue, xMin, xRange),
    critRightText: `t = ${criticalValue.toFixed(2)}`,
    critRightX: mapPowerX(criticalValue, xMin, xRange),
    deltaText: `δ = ${delta.toFixed(2)}`,
    h0Fill: filledRegion(h0Points, xMin, xRange, yMax),
    h0Line: pathFromPoints(h0Points, xMin, xRange, yMax),
    h0MeanX: mapPowerX(0, xMin, xRange),
    h1Fill: filledRegion(h1Points, xMin, xRange, yMax),
    h1Line: pathFromPoints(h1Points, xMin, xRange, yMax),
    h1MeanText: `H₁: d=${projection.d.toFixed(2)}, N=${projection.n}`,
    h1MeanX: mapPowerX(delta, xMin, xRange),
    leftTailFill: h0LeftTail.length > 1 ? filledRegion(h0LeftTail, xMin, xRange, yMax) : "",
    powerLeftFill: h1PowerLeft.length > 1 ? filledRegion(h1PowerLeft, xMin, xRange, yMax) : "",
    powerRightFill: h1PowerRight.length > 1 ? filledRegion(h1PowerRight, xMin, xRange, yMax) : "",
    rightTailFill: h0RightTail.length > 1 ? filledRegion(h0RightTail, xMin, xRange, yMax) : ""
  }
}
