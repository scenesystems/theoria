import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"

import { setPowerAlphaLevelAtom, setPowerEffectSizeAtom, setPowerSampleSizeAtom } from "../../atoms/widget-controls.js"
import { powerWidgetViewModelAtom } from "../../atoms/widget-view-models.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { Stack } from "../primitives/Layout.js"
import { MetricStrip } from "../primitives/MetricStrip.js"
import { PowerDistributionChart } from "../primitives/PowerDistributionChart.js"
import { LoadingIndicator } from "../primitives/Skeleton.js"
import { SliderRow } from "../primitives/SliderRow.js"

const tone = toneClassesFor("math")

export const LivePowerExplorer = () => {
  const vm = useAtomValue(powerWidgetViewModelAtom)
  const setEffectSize = useAtomSet(setPowerEffectSizeAtom)
  const setSampleSize = useAtomSet(setPowerSampleSizeAtom)
  const setAlpha = useAtomSet(setPowerAlphaLevelAtom)

  return (
    <Stack className="mx-auto w-full max-w-6xl gap-4 xl:px-4 2xl:px-6">
      <Stack className="gap-1.5">
        <SliderRow
          disabled={vm.isAnimating}
          display={vm.controls.effectSize.display}
          label="d"
          max={vm.controls.effectSize.max}
          min={vm.controls.effectSize.min}
          onChange={setEffectSize}
          step={vm.controls.effectSize.step}
          tone={tone}
          value={vm.controls.effectSize.value}
        />
        <SliderRow
          disabled={vm.isAnimating}
          display={vm.controls.sampleSize.display}
          label="N"
          max={vm.controls.sampleSize.max}
          min={vm.controls.sampleSize.min}
          onChange={setSampleSize}
          step={vm.controls.sampleSize.step}
          tone={tone}
          value={vm.controls.sampleSize.value}
        />
        <SliderRow
          disabled={vm.isAnimating}
          display={vm.controls.alpha.display}
          label="α"
          max={vm.controls.alpha.max}
          min={vm.controls.alpha.min}
          onChange={setAlpha}
          step={vm.controls.alpha.step}
          tone={tone}
          value={vm.controls.alpha.value}
        />
        <LoadingIndicator active={vm.isAnimating} text="Sweeping parameter space…" tone={tone} />
      </Stack>
      <MetricStrip metrics={vm.metrics} />
      <PowerDistributionChart vm={vm} />
    </Stack>
  )
}
