import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { memo } from "react"

import { setOptimizationTrialBudgetAtom } from "../../atoms/widget-controls.js"
import { optimizationWidgetViewModelAtom } from "../../atoms/widget-view-models.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { InstrumentPanel } from "../primitives/InstrumentPanel.js"
import { Stack } from "../primitives/Layout.js"
import { OptimizationContourCanvas } from "../primitives/OptimizationContourCanvas.js"
import { LoadingIndicator } from "../primitives/Skeleton.js"
import { SliderRow } from "../primitives/SliderRow.js"

const tone = toneClassesFor("search")

const LiveOptimizationView = () => {
  const vm = useAtomValue(optimizationWidgetViewModelAtom)
  const setBudget = useAtomSet(setOptimizationTrialBudgetAtom)

  return (
    <InstrumentPanel
      controls={
        <Stack className="gap-4">
          <SliderRow
            disabled={vm.controlsLocked}
            display={vm.budget.display}
            label="Trials"
            max={vm.budget.max}
            min={vm.budget.min}
            onChange={setBudget}
            step={vm.budget.step}
            tone={tone}
            value={vm.budget.value}
          />
          <LoadingIndicator
            active={vm.isAnimating}
            text={vm.statusText ?? "Streaming optimization evidence…"}
            tone={tone}
          />
        </Stack>
      }
      metrics={vm.metrics}
    >
      <OptimizationContourCanvas vm={vm} />
    </InstrumentPanel>
  )
}

export const LiveOptimization = memo(LiveOptimizationView)
