import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"

import { briefMaxLength, placeScenarioMeta, placeScenarios } from "../../../contracts/imagined-place.js"
import {
  chooseScenarioAtom,
  placeBriefAtom,
  placeBriefDraftAtom,
  placeBriefEditedAtom,
  placeControlsAtom
} from "../../atoms/imagined-place.js"
import { ChoiceGroup } from "../primitives/ChoiceGroup.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { Layer } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { FieldDescription, FieldGroup, FieldLabel, TextAreaField } from "../primitives/TextAreaField.js"

import { briefCountText } from "./placeViewModel.js"

const scenarioOptions = Arr.map(placeScenarios, (scenario, index) => ({
  index,
  label: placeScenarioMeta[scenario].label
}))

const tone = toneClassesFor("dsp")

/**
 * The scenario: which recorded story the demonstration tells. Choosing one
 * sets the brief to that story's brief. It is its own control, outside the
 * Brief field, so the field's label names only the textarea. Drawn as a
 * segmented control: exactly one of three, in cells of equal width — so the
 * cells are the rail's to divide, not the labels' to measure, and a served
 * face arriving a glyph wider than its stand-in moves none of them.
 */
export const ScenarioChoice = ({ disabled }: { readonly disabled: boolean }) => {
  const controls = useAtomValue(placeControlsAtom)
  const chooseScenario = useAtomSet(chooseScenarioAtom)
  const activeIndex = Option.getOrElse(
    Arr.findFirstIndex(placeScenarios, (scenario) => scenario === controls.scenario),
    () => 0
  )

  return (
    <ChoiceGroup
      activeIndex={activeIndex}
      appearance="segment"
      disabled={disabled}
      label="Scenario"
      onSelect={(index) => {
        Option.map(Arr.get(placeScenarios, index), chooseScenario)
      }}
      options={scenarioOptions}
      tone={tone}
    />
  )
}

/**
 * The brief: what the composer was asked for. It feeds the composer program
 * on the server; the field is dirty when the brief no longer
 * matches the recorded one.
 */
export const BriefField = ({ disabled }: { readonly disabled: boolean }) => {
  const scenario = useAtomValue(placeControlsAtom).scenario
  const brief = useAtomValue(placeBriefAtom)
  const edited = useAtomValue(placeBriefEditedAtom)
  const setDraft = useAtomSet(placeBriefDraftAtom)

  return (
    <FieldGroup className="gap-3" dirty={edited} disabled={disabled}>
      <Layer className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
        <FieldLabel>
          <SemanticText as="span" className="text-ink-900" role="row-label" text="Brief" variant="compact" />
        </FieldLabel>
        <FieldDescription>
          <SemanticText
            as="span"
            className="text-ink-500"
            role="code-meta"
            text={briefCountText(brief.length, briefMaxLength)}
            variant="compact"
          />
        </FieldDescription>
      </Layer>
      <TextAreaField
        onValueChange={(next) => {
          setDraft(Option.some({ scenario, text: next.slice(0, briefMaxLength) }))
        }}
        placeholder="Describe the place you want to share…"
        rows={5}
        tone={tone}
        value={brief}
      />
    </FieldGroup>
  )
}
