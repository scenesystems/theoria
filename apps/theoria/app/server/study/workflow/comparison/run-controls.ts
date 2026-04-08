import type { WorkflowExecutionRecord } from "effect-inference/Contracts"

import type { WorkflowEntrySeedSelection } from "../../../../contracts/study/workflow/comparison/run.js"
import type { WorkflowComparisonSelectedKnobs } from "./runtime-plan.js"

const supportedChoice = ({
  choices,
  value
}: {
  readonly choices: ReadonlyArray<string>
  readonly value: string
}): string | null => (choices.includes(value) ? value : null)

const authoredSelectionForRecord = (record: WorkflowExecutionRecord): WorkflowComparisonSelectedKnobs =>
  record.graph.optimizationKnobs.reduce<WorkflowComparisonSelectedKnobs>(
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
  readonly plan: WorkflowEntrySeedSelection
}): string | null =>
  key === "runtime-profile" && plan.controls.runtimeProfile !== "authored"
    ? supportedChoice({ choices: knobChoices, value: plan.controls.runtimeProfile })
    : key === "surface-profile" && plan.controls.surfaceProfile !== "authored"
    ? supportedChoice({ choices: knobChoices, value: plan.controls.surfaceProfile })
    : null

export const workflowComparisonSelectedKnobsForRecord = ({
  plan,
  record
}: {
  readonly plan: WorkflowEntrySeedSelection
  readonly record: WorkflowExecutionRecord
}): WorkflowComparisonSelectedKnobs =>
  record.graph.optimizationKnobs.reduce<WorkflowComparisonSelectedKnobs>((selection, knob) => {
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

export const workflowComparisonChoicesForPlan = ({
  choices,
  key,
  plan
}: {
  readonly choices: ReadonlyArray<string>
  readonly key: string
  readonly plan: WorkflowEntrySeedSelection
}): ReadonlyArray<string> => {
  const boundedChoice = boundedChoiceForKnob({ key, knobChoices: choices, plan })

  return boundedChoice === null ? choices : [boundedChoice]
}

export const workflowEntrySelectionUsesOptimization = (plan: WorkflowEntrySeedSelection): boolean =>
  plan.controls.optimize

export const workflowEntrySelectionUsesSearchWinner = (plan: WorkflowEntrySeedSelection): boolean =>
  plan.controls.optimize && plan.controls.comparisonMode === "search-winner"
