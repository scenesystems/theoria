import * as Arr from "effect/Array"

import { Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"
import { surfaceMaterials } from "./theme/surface.js"

type SparklineSurface = "panel" | "flush"

const SVG_W = 200
const SVG_H = 40
const PADDING = 2

type Point = {
  readonly x: number
  readonly y: number
}

const pointsFor = (values: ReadonlyArray<number>): ReadonlyArray<Point> => {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const xStep = values.length <= 1 ? 0 : (SVG_W - PADDING * 2) / (values.length - 1)

  return Arr.map(values, (value, index) => ({
    x: PADDING + index * xStep,
    y: SVG_H - PADDING - ((value - min) / range) * (SVG_H - PADDING * 2)
  }))
}

const linePathFor = (points: ReadonlyArray<Point>): string =>
  points.length < 2
    ? ""
    : Arr.map(points, (point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(
      " "
    )

const areaPathFor = (points: ReadonlyArray<Point>): string => {
  const linePath = linePathFor(points)
  const first = points[0]
  const last = points[points.length - 1]

  return first === undefined || last === undefined || linePath.length === 0
    ? ""
    : `${linePath} L${last.x.toFixed(1)},${(SVG_H - PADDING).toFixed(1)} L${first.x.toFixed(1)},${
      (SVG_H - PADDING).toFixed(1)
    } Z`
}

export const Sparkline = ({
  label,
  surface = "panel",
  values,
  unit,
  summaryItems
}: {
  readonly label: string
  readonly surface?: SparklineSurface
  readonly values: ReadonlyArray<number>
  readonly unit?: string
  readonly summaryItems?: Array<{ readonly label: string; readonly value: string }>
}) => {
  const points = pointsFor(values)
  const linePath = linePathFor(points)
  const areaPath = areaPathFor(points)
  const latest = points[points.length - 1]
  const shellClassName = surface === "flush" ? "border-y border-stage-200/72" : surfaceMaterials.chartFrame
  const bodyClassName = surface === "flush" ? "gap-4 py-3" : "gap-4 px-4 py-3"

  return (
    <Layer className={shellClassName}>
      <Stack className={bodyClassName}>
        <SemanticText as="p" className="text-ink-700" role="row-label" text={label} variant="expanded" />
        {linePath.length > 0 ?
          (
            <svg
              aria-hidden
              className="h-16 w-full"
              preserveAspectRatio="none"
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            >
              {Arr.map([0.25, 0.5, 0.75], (ratio) => (
                <line
                  key={ratio}
                  x1={PADDING}
                  x2={SVG_W - PADDING}
                  y1={(SVG_H - PADDING) * ratio}
                  y2={(SVG_H - PADDING) * ratio}
                  className="stroke-stage-200/80"
                  strokeWidth="1"
                />
              ))}
              {areaPath.length === 0
                ? null
                : <path className="fill-stage-200/70" d={areaPath} fill="currentColor" opacity="0.65" />}
              <path
                d={linePath}
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="text-ink-800"
              />
              {latest === undefined
                ? null
                : (
                  <circle
                    className="fill-ink-900 stroke-stage-0"
                    cx={latest.x}
                    cy={latest.y}
                    r="2.8"
                    strokeWidth="1.5"
                  />
                )}
            </svg>
          ) :
          null}
        {summaryItems !== undefined && Arr.isNonEmptyArray(summaryItems) ?
          (
            <Layer as="dl" className="grid gap-0 border-t border-stage-200/68 pt-3 sm:grid-cols-3">
              {Arr.map(
                summaryItems,
                (item, index) => (
                  <Layer
                    className={`${
                      index === 0 ? "" : "border-t border-stage-200/60 pt-3 sm:border-t-0 sm:border-l sm:pl-4 sm:pt-0"
                    }`}
                    key={item.label}
                  >
                    <Stack className="gap-0.5">
                      <SemanticText
                        as="dt"
                        className="text-ink-700"
                        role="row-label"
                        text={item.label}
                        variant="expanded"
                      />
                      <SemanticText
                        as="dd"
                        className="tabular-nums text-ink-800"
                        role="code-meta"
                        text={`${item.value}${unit !== undefined ? ` ${unit}` : ""}`}
                        variant="expanded"
                      />
                    </Stack>
                  </Layer>
                )
              )}
            </Layer>
          ) :
          null}
      </Stack>
    </Layer>
  )
}
