import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { memo } from "react"

import { setOptimizationTrialBudgetAtom } from "../../atoms/widget-controls.js"
import { optimizationWidgetViewModelAtom } from "../../atoms/widget-view-models.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { Stack } from "../primitives/Layout.js"
import { MetricStrip } from "../primitives/MetricStrip.js"
import { OptimizationContourCanvas } from "../primitives/OptimizationContourCanvas.js"
import { LoadingIndicator } from "../primitives/Skeleton.js"
import { SliderRow } from "../primitives/SliderRow.js"

const tone = toneClassesFor("search")

const LiveOptimizationView = () => {
  const vm = useAtomValue(optimizationWidgetViewModelAtom)
  const setBudget = useAtomSet(setOptimizationTrialBudgetAtom)

  return (
    <Stack className="mx-auto w-full max-w-6xl gap-4 xl:px-4 2xl:px-6">
      <Stack className="gap-3">
        <SliderRow
          disabled={vm.isAnimating}
          display={vm.budget.display}
          label="Trials"
          max={vm.budget.max}
          min={vm.budget.min}
          onChange={setBudget}
          step={vm.budget.step}
          tone={tone}
          value={vm.budget.value}
        />
        <LoadingIndicator active={vm.isAnimating} text="Optimizing…" tone={tone} />
      </Stack>
      <MetricStrip metrics={vm.metrics} />
      <OptimizationContourCanvas vm={vm} />
    </Stack>
  )
}

export const LiveOptimization = memo(LiveOptimizationView)
