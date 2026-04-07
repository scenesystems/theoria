import type { WorkflowExecutionRecord } from "effect-inference/Contracts"

import type { WorkflowComparisonRunPlan } from "../../contracts/workflow/comparison-run.js"
import type { WorkflowComparisonSelectedKnobs } from "./runtime.js"

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
  readonly plan: WorkflowComparisonRunPlan
}): string | null =>
  key === "runtime-profile" && plan.runtimeProfile !== "authored"
    ? supportedChoice({ choices: knobChoices, value: plan.runtimeProfile })
    : key === "surface-profile" && plan.surfaceProfile !== "authored"
    ? supportedChoice({ choices: knobChoices, value: plan.surfaceProfile })
    : null

export const workflowComparisonSelectedKnobsForRecord = ({
  plan,
  record
}: {
  readonly plan: WorkflowComparisonRunPlan
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
  readonly plan: WorkflowComparisonRunPlan
}): ReadonlyArray<string> => {
  const boundedChoice = boundedChoiceForKnob({ key, knobChoices: choices, plan })

  return boundedChoice === null ? choices : [boundedChoice]
}

export const workflowComparisonRunPlanUsesOptimization = (plan: WorkflowComparisonRunPlan): boolean => plan.optimize

export const workflowComparisonRunPlanUsesSearchWinner = (plan: WorkflowComparisonRunPlan): boolean =>
  plan.optimize && plan.comparisonMode === "search-winner"
