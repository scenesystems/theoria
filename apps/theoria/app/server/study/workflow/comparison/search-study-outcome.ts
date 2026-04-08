import { Effect, Either, Match, Option, Schema } from "effect"
import type { Study } from "effect-search"

import {
  WorkflowComparisonExecutionError,
  type WorkflowEntrySeedSelection
} from "../../../../contracts/study/workflow/comparison/run.js"
import type { FrozenWorkflowComparisonRun } from "./frozen.js"
import { type WorkflowComparisonSelectedKnobs, WorkflowComparisonSelectedKnobsSchema } from "./runtime-plan.js"
import type { WorkflowComparisonSearchEvaluation, WorkflowComparisonSearchStudyOutcome } from "./search-study-schema.js"
import {
  authoredOptimizedSelection,
  selectionKey,
  type WorkflowComparisonSearchDimension
} from "./search-study-space.js"

const decodeSelectedKnobsEither = Schema.decodeUnknownEither(WorkflowComparisonSelectedKnobsSchema)

const executionError = (message: string) =>
  new WorkflowComparisonExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

export const selectionFromSearchStudyConfig = (
  config: unknown
): Effect.Effect<WorkflowComparisonSelectedKnobs, WorkflowComparisonExecutionError, never> =>
  Either.match(decodeSelectedKnobsEither(config), {
    onLeft: () =>
      Effect.fail(
        executionError("Workflow comparison study produced an invalid knob-selection config.")
      ),
    onRight: Effect.succeed
  })

const singleObjectiveBestSelectionKey = <Config>({
  dimensions,
  result
}: {
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly result: Study.StudyResult<Config>
}): Effect.Effect<string, WorkflowComparisonExecutionError, never> =>
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
          "Workflow comparison search opened a multi-objective study for a single-score optimization lane."
        )
      )
    )
  )

export const workflowComparisonSearchStudyOutcome = <Config>({
  comparison,
  dimensions,
  evaluations,
  events,
  plan,
  result,
  snapshot,
  trialBudget
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly evaluations: Readonly<Record<string, WorkflowComparisonSearchEvaluation>>
  readonly events: WorkflowComparisonSearchStudyOutcome["events"]
  readonly plan: WorkflowEntrySeedSelection
  readonly result: Study.StudyResult<Config>
  readonly snapshot: WorkflowComparisonSearchStudyOutcome["snapshot"]
  readonly trialBudget: number
}): Effect.Effect<WorkflowComparisonSearchStudyOutcome, WorkflowComparisonExecutionError, never> =>
  Effect.gen(function*() {
    const bestSelectionKey = yield* singleObjectiveBestSelectionKey({
      dimensions,
      result
    })
    const authoredSelection = authoredOptimizedSelection(comparison, plan)
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
              `Workflow comparison study did not retain authored and winner evaluations for ${comparison.comparisonId}.`
            )
          ),
        onSome: ({ authored, winner }) =>
          Effect.succeed({
            trialBudget,
            events,
            snapshot,
            authored,
            winner
          })
      })
    )
  })
