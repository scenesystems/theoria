import type { Schema } from "effect"
import { Effect, Equal } from "effect"
import { SearchSpace } from "effect-search"
import * as Arr from "effect/Array"

import {
  type WorkflowStudyExecutionError,
  WorkflowStudyExecutionError as WorkflowStudyExecutionErrorSchema
} from "../../../../contracts/study/workflow/execution.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import type { WorkflowEntrySelection } from "../../../../contracts/study/workflow/selection.js"
import { workflowChoicesForSelection } from "../selection-controls.js"

export type WorkflowSearchDimension = {
  readonly key: string
  readonly choices: ReadonlyArray<string>
}

const executionError = (message: string): WorkflowStudyExecutionError =>
  new WorkflowStudyExecutionErrorSchema({
    code: "execution-failed",
    message,
    retryable: false
  })

const categoricalDimension = (choices: ReadonlyArray<string>) =>
  Arr.matchLeft(choices, {
    onEmpty: () => SearchSpace.categorical(["unreachable-empty-choice"]),
    onNonEmpty: (head, tail) => SearchSpace.categorical([head, ...tail])
  })

export const workflowSearchDimensions = (
  workflowRun: FrozenWorkflowRun,
  plan: WorkflowEntrySelection
): Effect.Effect<ReadonlyArray<WorkflowSearchDimension>, WorkflowStudyExecutionError, never> => {
  const dimensions = workflowRun.optimized.record.graph.optimizationKnobs.map((knob) => ({
    key: knob.key,
    choices: workflowChoicesForSelection({
      choices: knob.choices,
      key: knob.key,
      plan
    })
  }))

  return Arr.some(dimensions, (dimension) => Equal.equals(dimension.choices.length, 0))
    ? Effect.fail(
      executionError(`Workflow scenario ${workflowRun.scenarioId} declared an empty optimization knob choice set.`)
    )
    : Effect.succeed(dimensions)
}

export const trialBudgetForDimensions = (dimensions: ReadonlyArray<WorkflowSearchDimension>): number =>
  dimensions.reduce((product, dimension) => product * dimension.choices.length, 1)

export const searchSpaceForDimensions = (dimensions: ReadonlyArray<WorkflowSearchDimension>) =>
  SearchSpace.unsafeMake(
    dimensions.reduce<Readonly<Record<string, Schema.Schema.AnyNoContext>>>(
      (definition, dimension) => ({
        ...definition,
        [dimension.key]: categoricalDimension(dimension.choices)
      }),
      {}
    )
  )
