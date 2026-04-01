import * as Arr from "effect/Array"
import * as Option from "effect/Option"
import { memo } from "react"

import { objectiveExpression, optimum, searchBounds } from "../../../contracts/demo/objective.js"
import type { OptimizationWidgetViewModel } from "../../atoms/widget-view-models.js"
import {
  mapOptimizationX,
  mapOptimizationY,
  OPTIMIZATION_SVG,
  optimizationContourData,
  optimizationOptimum,
  optimizationPlotBounds
} from "../data/optimizationContours.js"
import { type LegendTheme, neutralSubtleLegendTheme, surfaceMaterials } from "./designSystem.js"
import { Cluster, Stack } from "./Layout.js"
import { LegendItem } from "./LegendItem.js"
import { SemanticText } from "./SemanticText.js"

const tpeTheme: LegendTheme = { swatch: "bg-tone-search-500 shadow-sm", label: "text-ink-700" }
const optimumTheme: LegendTheme = { swatch: "bg-tone-search-400 shadow-sm", label: "text-ink-700" }

const contourLineElements = Arr.flatMap(
  optimizationContourData,
  ({ color, level, opacity, segments, width }) =>
    Arr.map(segments, (segment, index) => (
      <line
        key={`contour-${level}-${index}`}
        opacity={opacity}
        stroke={color}
        strokeWidth={width}
        x1={segment.x1.toFixed(1)}
        x2={segment.x2.toFixed(1)}
        y1={segment.y1.toFixed(1)}
        y2={segment.y2.toFixed(1)}
      />
    ))
)

const OptimizationContourBackdrop = memo(() => (
  <>
    <defs>
      <radialGradient
        id="optimization-optimum-glow"
        cx={optimizationOptimum.x / OPTIMIZATION_SVG.width}
        cy={optimizationOptimum.y / OPTIMIZATION_SVG.height}
        r="0.35"
      >
        <stop offset="0%" stopColor="var(--color-tone-search-300)" stopOpacity="0.18" />
        <stop offset="100%" stopColor="var(--color-tone-search-100)" stopOpacity="0" />
      </radialGradient>
    </defs>

    <rect
      fill="url(#optimization-optimum-glow)"
      height={optimizationPlotBounds.height}
      width={optimizationPlotBounds.width}
      x={OPTIMIZATION_SVG.padding.left}
      y={OPTIMIZATION_SVG.padding.top}
    />

    {contourLineElements}

    <line
      className="stroke-tone-search-300/50"
      strokeDasharray="4 3"
      strokeWidth="0.75"
      x1={optimizationOptimum.x}
      x2={optimizationOptimum.x}
      y1={OPTIMIZATION_SVG.padding.top}
      y2={OPTIMIZATION_SVG.padding.top + optimizationPlotBounds.height}
    />
    <line
      className="stroke-tone-search-300/50"
      strokeDasharray="4 3"
      strokeWidth="0.75"
      x1={OPTIMIZATION_SVG.padding.left}
      x2={OPTIMIZATION_SVG.padding.left + optimizationPlotBounds.width}
      y1={optimizationOptimum.y}
      y2={optimizationOptimum.y}
    />
    <circle className="fill-tone-search-400/15" cx={optimizationOptimum.x} cy={optimizationOptimum.y} r="14" />
    <polygon
      className="fill-tone-search-400 stroke-tone-search-700"
      points={`${optimizationOptimum.x},${optimizationOptimum.y - 7} ${
        optimizationOptimum.x + 6
      },${optimizationOptimum.y} ${optimizationOptimum.x},${optimizationOptimum.y + 7} ${
        optimizationOptimum.x - 6
      },${optimizationOptimum.y}`}
      strokeWidth="1.5"
    />
  </>
))

OptimizationContourBackdrop.displayName = "OptimizationContourBackdrop"

export const OptimizationContourCanvas = ({ vm }: { readonly vm: OptimizationWidgetViewModel }) => {
  const tpeBestPoint = Option.getOrNull(vm.projection.tpeBestPoint)
  const randomBestPoint = Option.getOrNull(vm.projection.randomBestPoint)

  return (
    <Stack className="min-w-0 gap-1.5">
      <svg
        className={`w-full ${surfaceMaterials.chartFrame}`}
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${OPTIMIZATION_SVG.width} ${OPTIMIZATION_SVG.height}`}
      >
        <OptimizationContourBackdrop />

        {Arr.map(vm.projection.randomTrials, (trial, index) => (
          <circle
            key={`random-${index}`}
            className="fill-ink-300 stroke-ink-400"
            cx={mapOptimizationX(trial.x).toFixed(1)}
            cy={mapOptimizationY(trial.y).toFixed(1)}
            opacity={0.6}
            r="3"
            strokeWidth="0.75"
          />
        ))}

        {Arr.map(vm.projection.tpeTrials, (trial, index) => (
          <circle
            key={`tpe-${index}`}
            className="fill-tone-search-500 stroke-tone-search-700"
            cx={mapOptimizationX(trial.x).toFixed(1)}
            cy={mapOptimizationY(trial.y).toFixed(1)}
            opacity={0.9}
            r="4"
            strokeWidth="0.75"
          />
        ))}

        {tpeBestPoint === null
          ? null
          : (
            <>
              <circle
                className="fill-tone-search-300/20"
                cx={mapOptimizationX(tpeBestPoint.x).toFixed(1)}
                cy={mapOptimizationY(tpeBestPoint.y).toFixed(1)}
                r="12"
              />
              <circle
                className="fill-none stroke-tone-search-500"
                cx={mapOptimizationX(tpeBestPoint.x).toFixed(1)}
                cy={mapOptimizationY(tpeBestPoint.y).toFixed(1)}
                r="7"
                strokeWidth="2"
              />
            </>
          )}

        {randomBestPoint === null
          ? null
          : (
            <circle
              className="fill-none stroke-ink-500"
              cx={mapOptimizationX(randomBestPoint.x).toFixed(1)}
              cy={mapOptimizationY(randomBestPoint.y).toFixed(1)}
              r="7"
              strokeDasharray="3 2"
              strokeWidth="1.5"
            />
          )}
      </svg>

      <Cluster className="justify-between px-1">
        <SemanticText
          as="span"
          className="text-ink-600"
          role="code-meta"
          text={`x ∈ [${searchBounds.xMin}, ${searchBounds.xMax}]`}
          variant="expanded"
        />
        <SemanticText
          as="span"
          className="text-tone-search-700"
          role="code-meta"
          text={objectiveExpression}
          variant="expanded"
        />
        <SemanticText
          as="span"
          className="text-ink-600"
          role="code-meta"
          text={`y ∈ [${searchBounds.yMin}, ${searchBounds.yMax}]`}
          variant="expanded"
        />
      </Cluster>

      <Cluster className="justify-center gap-3 sm:gap-5">
        <LegendItem label="TPE (adaptive)" shape="circle" theme={tpeTheme} />
        <LegendItem label="Random" shape="circle" theme={neutralSubtleLegendTheme} />
        <LegendItem
          label="Optimum"
          shape="diamond"
          theme={optimumTheme}
          value={`(${optimum.x}, ${optimum.y})`}
        />
      </Cluster>
    </Stack>
  )
}
