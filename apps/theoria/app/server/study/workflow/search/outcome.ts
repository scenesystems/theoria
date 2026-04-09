import { Effect, Either, Match, Option, Schema } from "effect"
import type { Study } from "effect-search"

import { WorkflowStudyExecutionError } from "../../../../contracts/study/workflow/execution.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import { WorkflowSelectedKnobs } from "../../../../contracts/study/workflow/runtime-plan.js"
import type { WorkflowEntrySelection } from "../../../../contracts/study/workflow/selection.js"
import type { WorkflowSearchDimension } from "./dimensions.js"
import { type WorkflowSearchEvaluation, WorkflowSearchStudyOutcome } from "./schema.js"
import { authoredOptimizedSelection, selectionKey } from "./selection-record.js"

const decodeSelectedKnobsEither = Schema.decodeUnknownEither(WorkflowSelectedKnobs)

const executionError = (message: string) =>
  new WorkflowStudyExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

export const selectionFromSearchStudyConfig = (
  config: unknown
): Effect.Effect<WorkflowSelectedKnobs, WorkflowStudyExecutionError, never> =>
  Either.match(decodeSelectedKnobsEither(config), {
    onLeft: () =>
      Effect.fail(
        executionError("Workflow study produced an invalid knob-selection config.")
      ),
    onRight: Effect.succeed
  })

const singleObjectiveBestSelectionKey = <Config>({
  dimensions,
  result
}: {
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
  readonly result: Study.StudyResult<Config>
}): Effect.Effect<string, WorkflowStudyExecutionError, never> =>
  Match.value(result).pipe(
    Match.when({ _tag: "SingleObjective" }, (singleObjective) =>
      selectionFromSearchStudyConfig(singleObjective.bestTrial.config).pipe(
        Effect.map((selection) =>
          selectionKey({ dimensions, selection })
        )
      )),
    Match.orElse(() =>
      Effect.fail(
        executionError(
          "Workflow search opened a multi-objective study for a single-score optimization lane."
        )
      )
    )
  )

export const workflowSearchStudyOutcome = <Config>({
  workflowRun,
  dimensions,
  evaluations,
  events,
  plan,
  result,
  snapshot,
  trialBudget
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
  readonly evaluations: Readonly<Record<string, WorkflowSearchEvaluation>>
  readonly events: WorkflowSearchStudyOutcome["events"]
  readonly plan: WorkflowEntrySelection
  readonly result: Study.StudyResult<Config>
  readonly snapshot: WorkflowSearchStudyOutcome["snapshot"]
  readonly trialBudget: number
}): Effect.Effect<WorkflowSearchStudyOutcome, WorkflowStudyExecutionError, never> =>
  Effect.gen(function*() {
    const bestSelectionKey = yield* singleObjectiveBestSelectionKey({
      dimensions,
      result
    })
    const authoredSelection = authoredOptimizedSelection(workflowRun, plan)
    const authoredSelectionKey = selectionKey({
      dimensions,
      selection: authoredSelection
    })
    const winner = evaluations[bestSelectionKey]
    const authored = evaluations[authoredSelectionKey]

    return yield* Option.all({
      authored: Option.fromNullable(authored),
      winner: Option.fromNullable(winner)
    }).pipe(
      Option.match({
        onNone: () =>
          Effect.fail(
            executionError(
              `Workflow study did not retain authored and winner evaluations for ${workflowRun.scenarioId}.`
            )
          ),
        onSome: ({ authored, winner }) =>
          Effect.try({
            try: () =>
              WorkflowSearchStudyOutcome.make({
                trialBudget,
                events,
                snapshot,
                authored,
                winner
              }),
            catch: () => executionError(`Workflow study outcome assembly failed for ${workflowRun.scenarioId}.`)
          })
      })
    )
  })
