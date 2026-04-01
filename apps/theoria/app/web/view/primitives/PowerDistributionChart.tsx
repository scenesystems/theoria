import { nonCentrality } from "../../../contracts/demo/power.js"
import type { PowerWidgetViewModel } from "../../atoms/widget-view-models.js"
import { POWER_SVG, powerChartModel } from "../data/powerChartModel.js"
import { dangerSubtleLegendTheme, type LegendTheme, neutralLegendTheme, surfaceMaterials } from "./designSystem.js"
import { Cluster, Stack } from "./Layout.js"
import { LegendItem } from "./LegendItem.js"
import { SemanticText } from "./SemanticText.js"

const h1Theme: LegendTheme = { swatch: "bg-tone-math-500", label: "text-ink-700" }
const powerTheme: LegendTheme = { swatch: "bg-tone-math-400/50", label: "text-ink-700" }

export const PowerDistributionChart = ({ vm }: { readonly vm: PowerWidgetViewModel }) => {
  const model = powerChartModel(vm.projection)
  const delta = nonCentrality(vm.projection.d, vm.projection.n)

  return (
    <Stack className="gap-1.5">
      <Cluster className="justify-between px-1">
        <SemanticText
          as="span"
          className="text-danger-600/80"
          role="code-meta"
          text={model.critLeftText}
          variant="expanded"
        />
        <SemanticText as="span" className="text-ink-700" role="code-meta" text="z-statistic" variant="expanded" />
        <SemanticText
          as="span"
          className="text-danger-600/80"
          role="code-meta"
          text={model.critRightText}
          variant="expanded"
        />
      </Cluster>

      <svg
        className={`w-full ${surfaceMaterials.chartFrame}`}
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${POWER_SVG.width} ${POWER_SVG.height}`}
      >
        <path className="fill-ink-700/[0.06]" d={model.h0Fill} />
        <path className="fill-tone-math-500/[0.08]" d={model.h1Fill} />
        {model.rightTailFill === "" ? null : <path className="fill-danger-500/25" d={model.rightTailFill} />}
        {model.leftTailFill === "" ? null : <path className="fill-danger-500/25" d={model.leftTailFill} />}
        {model.powerRightFill === "" ? null : <path className="fill-tone-math-400/30" d={model.powerRightFill} />}
        {model.powerLeftFill === "" ? null : <path className="fill-tone-math-400/15" d={model.powerLeftFill} />}
        <path className="stroke-ink-700" d={model.h0Line} fill="none" strokeWidth="2" />
        <path className="stroke-tone-math-500" d={model.h1Line} fill="none" strokeWidth="2" />
        <line
          className="stroke-danger-500"
          strokeDasharray="6 3"
          strokeWidth="1.25"
          x1={model.critRightX}
          x2={model.critRightX}
          y1={POWER_SVG.padding.top}
          y2={model.baseline}
        />
        <line
          className="stroke-danger-500"
          strokeDasharray="6 3"
          strokeWidth="1.25"
          x1={model.critLeftX}
          x2={model.critLeftX}
          y1={POWER_SVG.padding.top}
          y2={model.baseline}
        />
        <circle className="fill-ink-700" cx={model.h0MeanX} cy={model.baseline} r="3" />
        <circle className="fill-tone-math-500" cx={model.h1MeanX} cy={model.baseline} r="3" />
        {delta <= 0.3
          ? null
          : (
            <g>
              <line
                className="stroke-tone-math-500"
                strokeDasharray="3 2"
                strokeWidth="1"
                x1={model.h0MeanX + 6}
                x2={model.h1MeanX - 6}
                y1={model.baseline - 6}
                y2={model.baseline - 6}
              />
              <polygon
                className="fill-tone-math-500"
                points={`${model.h1MeanX - 6},${model.baseline - 9} ${model.h1MeanX - 6},${model.baseline - 3} ${
                  model.h1MeanX - 1
                },${model.baseline - 6}`}
              />
            </g>
          )}
      </svg>

      <Cluster className="justify-between px-1">
        <SemanticText as="span" className="text-ink-700" role="code-meta" text="μ₀ = 0" variant="expanded" />
        <SemanticText
          as="span"
          className="text-tone-math-700"
          role="code-meta"
          text={model.deltaText}
          variant="expanded"
        />
      </Cluster>

      <Cluster className="justify-center gap-5">
        <LegendItem label="H₀: no effect" shape="circle" theme={neutralLegendTheme} />
        <LegendItem label={model.h1MeanText} shape="circle" theme={h1Theme} />
        <LegendItem label={model.alphaText} shape="square" theme={dangerSubtleLegendTheme} />
        <LegendItem label="Power" shape="square" theme={powerTheme} />
      </Cluster>
    </Stack>
  )
}
