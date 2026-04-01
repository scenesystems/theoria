import * as Arr from "effect/Array"

import { surfaceMaterials } from "./designSystem.js"
import { Cluster, Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

const SVG_W = 200
const SVG_H = 40
const PADDING = 2

const buildPath = (values: ReadonlyArray<number>): string => {
  if (values.length < 2) return ""
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const xStep = (SVG_W - PADDING * 2) / (values.length - 1)

  return Arr.map(values, (v, i) => {
    const x = PADDING + i * xStep
    const y = SVG_H - PADDING - ((v - min) / range) * (SVG_H - PADDING * 2)
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
}

export const Sparkline = ({
  label,
  values,
  unit,
  summaryItems
}: {
  readonly label: string
  readonly values: ReadonlyArray<number>
  readonly unit?: string
  readonly summaryItems?: Array<{ readonly label: string; readonly value: string }>
}) => {
  const path = buildPath(values)

  return (
    <Layer className={surfaceMaterials.evidenceCard}>
      <Stack className="gap-2">
        <SemanticText as="dt" className="text-ink-700" role="row-label" text={label} variant="expanded" />
        {path.length > 0 ?
          (
            <svg
              aria-hidden
              className="h-10 w-full"
              preserveAspectRatio="none"
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            >
              <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                className="text-ink-700"
              />
            </svg>
          ) :
          null}
        {summaryItems !== undefined && Arr.isNonEmptyArray(summaryItems) ?
          (
            <Cluster className="gap-4">
              {Arr.map(summaryItems, (item) => (
                <Stack key={item.label} className="gap-0">
                  <SemanticText
                    as="span"
                    className="text-ink-700"
                    role="row-label"
                    text={item.label}
                    variant="expanded"
                  />
                  <SemanticText
                    as="span"
                    className="tabular-nums text-ink-800"
                    role="code-meta"
                    text={`${item.value}${unit !== undefined ? ` ${unit}` : ""}`}
                    variant="expanded"
                  />
                </Stack>
              ))}
            </Cluster>
          ) :
          null}
      </Stack>
    </Layer>
  )
}
