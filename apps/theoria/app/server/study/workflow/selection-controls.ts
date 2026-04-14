import type { WorkflowExecutionRecord } from "effect-inference/Contracts"

import type { WorkflowSelectedKnobs } from "../../../contracts/study/workflow/runtime-plan.js"
import type { WorkflowEntrySelection } from "../../../contracts/study/workflow/selection.js"

const supportedChoice = ({
  choices,
  value
}: {
  readonly choices: ReadonlyArray<string>
  readonly value: string
}): string | null => (choices.includes(value) ? value : null)

const authoredSelectionForRecord = (record: WorkflowExecutionRecord): WorkflowSelectedKnobs =>
  record.graph.optimizationKnobs.reduce<WorkflowSelectedKnobs>(
    (selection, knob) => ({
      ...selection,
      [knob.key]: knob.choices[0] ?? ""
    }),
    {}
  )

const boundedChoiceForKnob = ({
  key,
  knobChoices,
  plan
}: {
  readonly key: string
  readonly knobChoices: ReadonlyArray<string>
  readonly plan: WorkflowEntrySelection
}): string | null =>
  key === "runtime-profile" && plan.controls.runtimeProfile !== "authored"
    ? supportedChoice({ choices: knobChoices, value: plan.controls.runtimeProfile })
    : key === "surface-profile" && plan.controls.surfaceProfile !== "authored"
    ? supportedChoice({ choices: knobChoices, value: plan.controls.surfaceProfile })
    : null

export const workflowSelectedKnobsForRecord = ({
  plan,
  record
}: {
  readonly plan: WorkflowEntrySelection
  readonly record: WorkflowExecutionRecord
}): WorkflowSelectedKnobs =>
  record.graph.optimizationKnobs.reduce<WorkflowSelectedKnobs>((selection, knob) => {
    const boundedChoice = boundedChoiceForKnob({
      key: knob.key,
      knobChoices: knob.choices,
      plan
    })

    return boundedChoice === null
      ? selection
      : {
        ...selection,
        [knob.key]: boundedChoice
      }
  }, authoredSelectionForRecord(record))

export const workflowChoicesForSelection = ({
  choices,
  key,
  plan
}: {
  readonly choices: ReadonlyArray<string>
  readonly key: string
  readonly plan: WorkflowEntrySelection
}): ReadonlyArray<string> => {
  const boundedChoice = boundedChoiceForKnob({ key, knobChoices: choices, plan })

  return boundedChoice === null ? choices : [boundedChoice]
}

export const workflowEntrySelectionUsesOptimization = (plan: WorkflowEntrySelection): boolean => plan.controls.optimize

export const workflowEntrySelectionUsesSearchWinner = (plan: WorkflowEntrySelection): boolean =>
  plan.controls.optimize && plan.controls.targetMode === "search-winner"
