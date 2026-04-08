import { Effect, Match, Option, Schema } from "effect"
import { projectWorkflowModuleGraph, WorkflowModuleGraphProjection } from "effect-dsp/contracts"
import {
  type GraphVariant,
  GraphVariantSchema,
  ScoreProfileSchema,
  type WorkflowExecutionRecord,
  WorkflowExecutionRecordSchema
} from "effect-inference/Contracts"

import { type WorkflowComparisonExecutionError } from "../../../../contracts/study/workflow/comparison/run.js"
import { WorkflowComparisonExecutionError as WorkflowComparisonExecutionErrorSchema } from "../../../../contracts/study/workflow/comparison/run.js"
import type { FrozenWorkflowComparisonRun } from "./frozen.js"

export const WorkflowComparisonSelectedKnobsSchema = Schema.Record({
  key: Schema.String,
  value: Schema.String
})

export type WorkflowComparisonSelectedKnobs = Schema.Schema.Type<typeof WorkflowComparisonSelectedKnobsSchema>

const emptySelectedKnobs: WorkflowComparisonSelectedKnobs = {}

export const WorkflowComparisonVariantPlanSchema = Schema.Struct({
  variant: GraphVariantSchema,
  record: WorkflowExecutionRecordSchema,
  profile: ScoreProfileSchema,
  selectedKnobs: WorkflowComparisonSelectedKnobsSchema,
  graphProjection: WorkflowModuleGraphProjection
})

export type WorkflowComparisonVariantPlan = Schema.Schema.Type<typeof WorkflowComparisonVariantPlanSchema>

const executionError = (message: string): WorkflowComparisonExecutionError =>
  new WorkflowComparisonExecutionErrorSchema({
    code: "execution-failed",
    message,
    retryable: false
  })

const frozenVariant = (
  comparison: FrozenWorkflowComparisonRun,
  variant: GraphVariant
): FrozenWorkflowComparisonRun["baseline"] | FrozenWorkflowComparisonRun["optimized"] =>
  Match.value(variant).pipe(
    Match.when("baseline", () => comparison.baseline),
    Match.when("optimized", () => comparison.optimized),
    Match.exhaustive
  )

export const prepareVariantPlan = ({
  comparison,
  profile,
  record,
  selectedKnobs = emptySelectedKnobs,
  variant
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly profile?: Schema.Schema.Type<typeof ScoreProfileSchema>
  readonly record?: WorkflowExecutionRecord
  readonly selectedKnobs?: WorkflowComparisonSelectedKnobs
  readonly variant: GraphVariant
}): Effect.Effect<WorkflowComparisonVariantPlan, WorkflowComparisonExecutionError, never> =>
  Option.all({
    profile: Option.fromNullable(profile),
    record: Option.fromNullable(record)
  }).pipe(
    Option.match({
      onNone: () => {
        const variantInput = frozenVariant(comparison, variant)

        return prepareVariantPlanForRecord({
          variant,
          record: variantInput.record,
          profile: variantInput.profile,
          selectedKnobs
        })
      },
      onSome: ({ profile: resolvedProfile, record: resolvedRecord }) =>
        prepareVariantPlanForRecord({
          variant,
          record: resolvedRecord,
          profile: resolvedProfile,
          selectedKnobs
        })
    })
  )

export const prepareVariantPlanForRecord = ({
  profile,
  record,
  selectedKnobs = emptySelectedKnobs,
  variant
}: {
  readonly profile: Schema.Schema.Type<typeof ScoreProfileSchema>
  readonly record: WorkflowExecutionRecord
  readonly selectedKnobs?: WorkflowComparisonSelectedKnobs
  readonly variant: GraphVariant
}): Effect.Effect<WorkflowComparisonVariantPlan, WorkflowComparisonExecutionError, never> =>
  Effect.try({
    try: () => ({
      variant,
      record,
      profile,
      selectedKnobs,
      graphProjection: projectWorkflowModuleGraph({
        manifest: record.graph,
        projection: record.projection
      })
    }),
    catch: () => executionError(`Workflow graph projection failed for the ${variant} variant.`)
  })
