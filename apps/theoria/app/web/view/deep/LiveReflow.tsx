import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"

import {
  selectReflowCorpusAtom,
  setCustomReflowTextAtom,
  setReflowWidthValueAtom,
  toggleReflowObstaclesAtom
} from "../../atoms/widget-controls.js"
import { reflowWidgetViewModelAtom } from "../../atoms/widget-view-models.js"
import { toneFor } from "../primitives/designSystem.js"

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
