import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"
import type { ChangeEvent } from "react"

import { briefMaxLength, placeScenarioMeta, placeScenarios } from "../../../contracts/imagined-place.js"
import { briefIsEdited, controlsForScenario, placeControlsAtom } from "../../atoms/imagined-place.js"
import { ChoicePills } from "../primitives/ChoicePills.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { TextAreaField } from "../primitives/TextAreaField.js"

import { briefCountText } from "./placeViewModel.js"

const scenarioOptions = Arr.map(placeScenarios, (scenario, index) => ({
  index,
  label: placeScenarioMeta[scenario].label
}))

const tone = toneClassesFor("dsp")

/**
 * The brief: pick a place pattern and say what you want in it. Both feed the
 * composer program on the server; the textarea's active state shows when the
 * brief no longer matches the recorded one.
 */
export const PlaceControls = ({ disabled }: { readonly disabled: boolean }) => {
  const controls = useAtomValue(placeControlsAtom)
  const setControls = useAtomSet(placeControlsAtom)
  const activeIndex = Option.getOrElse(
    Arr.findFirstIndex(placeScenarios, (scenario) => scenario === controls.scenario),
    () => 0
  )

  return (
    <Stack className="gap-3">
      <Layer className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
        <SemanticText as="span" className="text-ink-900" role="row-label" text="Brief" variant="compact" />
        <SemanticText
          as="span"
          className="text-ink-500"
          role="code-meta"
          text={briefCountText(controls.brief.length, briefMaxLength)}
          variant="compact"
        />
      </Layer>
      <ChoicePills
        activeIndex={activeIndex}
        className="gap-1.5"
        disabled={disabled}
        onSelect={(index) => {
          Option.map(Arr.get(placeScenarios, index), (scenario) => {
            setControls((current) => controlsForScenario(current, scenario))
          })
        }}
        options={scenarioOptions}
        tone={tone}
      />
      <TextAreaField
        active={briefIsEdited(controls)}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          const brief = event.target.value.slice(0, briefMaxLength)
          setControls((current) => ({ ...current, brief }))
        }}
        placeholder="Describe the place you want to share…"
        rows={5}
        tone={tone}
        value={controls.brief}
      />
    </Stack>
  )
}
