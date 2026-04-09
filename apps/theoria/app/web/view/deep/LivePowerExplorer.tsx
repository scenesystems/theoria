import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"

import { powerWidgetViewModelAtom } from "../../atoms/power-widget-view-model.js"
import { setPowerAlphaLevelAtom, setPowerEffectSizeAtom, setPowerSampleSizeAtom } from "../../atoms/widget-controls.js"
import { InstrumentPanel } from "../primitives/InstrumentPanel.js"
import { Stack } from "../primitives/Layout.js"
import { PowerDistributionChart } from "../primitives/PowerDistributionChart.js"
import { LoadingIndicator } from "../primitives/Skeleton.js"
import { SliderRow } from "../primitives/SliderRow.js"
import { toneFor } from "../primitives/theme/tone.js"

const tone = toneFor("math")

export const LivePowerExplorer = () => {
  const vm = useAtomValue(powerWidgetViewModelAtom)
  const setEffectSize = useAtomSet(setPowerEffectSizeAtom)
  const setSampleSize = useAtomSet(setPowerSampleSizeAtom)
  const setAlpha = useAtomSet(setPowerAlphaLevelAtom)

  return (
    <InstrumentPanel
      controls={
        <Stack className="gap-1.5">
          <SliderRow
            disabled={vm.controlsLocked}
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
            disabled={vm.controlsLocked}
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
            disabled={vm.controlsLocked}
            display={vm.controls.alpha.display}
            label="α"
            max={vm.controls.alpha.max}
            min={vm.controls.alpha.min}
            onChange={setAlpha}
            step={vm.controls.alpha.step}
            tone={tone}
            value={vm.controls.alpha.value}
          />
          <LoadingIndicator active={vm.isAnimating} text={vm.statusText ?? "Streaming power analysis…"} tone={tone} />
        </Stack>
      }
      metrics={vm.metrics}
    >
      <PowerDistributionChart vm={vm} />
    </InstrumentPanel>
  )
}
