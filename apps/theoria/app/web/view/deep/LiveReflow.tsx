import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"

import { reflowWidgetViewModelAtom } from "../../atoms/reflow-widget-view-model.js"
import {
  selectReflowCorpusAtom,
  setCustomReflowTextAtom,
  setReflowWidthValueAtom,
  toggleReflowObstaclesAtom
} from "../../atoms/widget-controls.js"
import { toneFor } from "../primitives/theme/tone.js"

import { ReflowStagePanel } from "./ReflowStagePanel.js"

const tone = toneFor("text")

export const LiveReflow = () => {
  const vm = useAtomValue(reflowWidgetViewModelAtom)
  const selectCorpus = useAtomSet(selectReflowCorpusAtom)
  const setCustomText = useAtomSet(setCustomReflowTextAtom)
  const setWidth = useAtomSet(setReflowWidthValueAtom)
  const toggleObstacles = useAtomSet(toggleReflowObstaclesAtom)

  return (
    <ReflowStagePanel
      onSelectCorpus={selectCorpus}
      onSetCustomText={setCustomText}
      onSetWidth={setWidth}
      onToggleObstacles={() => {
        toggleObstacles()
      }}
      tone={tone}
      vm={vm}
    />
  )
}
