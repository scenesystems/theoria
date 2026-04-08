import { Effect, Match, Option, Schema } from "effect"
import {
  GraphVariantSchema,
  type ScoreProfile,
  ScoreProfileSchema,
  type WorkflowExecutionRecord,
  WorkflowExecutionRecordSchema,
  WorkflowKindSchema
} from "effect-inference/Contracts"

import { DurableFingerprint, fingerprintOf } from "../../../../contracts/entry/fingerprint.js"
import {
  WorkflowComparisonAuthorityBindingsSchema,
  type WorkflowComparisonId,
  WorkflowComparisonIdSchema
} from "../../../../contracts/study/workflow/comparison/comparison.js"
import { WorkflowComparisonExecutionError } from "../../../../contracts/study/workflow/comparison/run.js"
import { workflowComparisonOptionById } from "./catalog.js"
import { workflowProfileLibrary } from "./profile-library.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const FrozenWorkflowComparisonVariantSchema = Schema.Struct({
  variant: GraphVariantSchema,
  record: WorkflowExecutionRecordSchema,
  profile: ScoreProfileSchema,
  recordFingerprint: DurableFingerprint
})

export type FrozenWorkflowComparisonVariant = Schema.Schema.Type<typeof FrozenWorkflowComparisonVariantSchema>

export const FrozenWorkflowComparisonRunSchema = Schema.Struct({
  entryId: Schema.Literal("workflow"),
  comparisonId: WorkflowComparisonIdSchema,
  label: NonEmptyString,
  summary: NonEmptyString,
  workflowKind: WorkflowKindSchema,
  authorities: WorkflowComparisonAuthorityBindingsSchema,
  baseline: FrozenWorkflowComparisonVariantSchema,
  optimized: FrozenWorkflowComparisonVariantSchema
})

export type FrozenWorkflowComparisonRun = Schema.Schema.Type<typeof FrozenWorkflowComparisonRunSchema>

const encodeFrozenWorkflowComparisonRun = Schema.encodeSync(FrozenWorkflowComparisonRunSchema)

const executionError = (message: string) =>
  new WorkflowComparisonExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

const invalidComparisonError = (comparisonId: string) =>
  new WorkflowComparisonExecutionError({
    code: "invalid-query",
    message: `Unknown workflow comparison ${comparisonId}.`,
    retryable: false
  })

const profileForRecord = (
  record: WorkflowExecutionRecord
): Effect.Effect<ScoreProfile, WorkflowComparisonExecutionError, never> => {
  const profile = Match.value(record.evaluation.profileFamily).pipe(
    Match.when("task-oriented", () => workflowProfileLibrary.taskOriented),
    Match.when("chat-oriented", () => workflowProfileLibrary.chatOriented),
    Match.when("retrieval-oriented", () => workflowProfileLibrary.retrievalOriented),
    Match.when("render-sensitive", () => workflowProfileLibrary.renderSensitive),
    Match.exhaustive
  )

  return profile.profileId !== record.evaluation.profileId
    ? Effect.fail(
      executionError(
        `Workflow score profile ${record.evaluation.profileId} does not match the authored ${record.evaluation.profileFamily} profile.`
      )
    )
    : !profile.workflowKinds.includes(record.workflowKind)
    ? Effect.fail(
      executionError(
        `Workflow score profile ${profile.profileId} does not admit workflow kind ${record.workflowKind}.`
      )
    )
    : Effect.succeed(profile)
}

const freezeVariant = ({
  record,
  variant
}: {
  readonly record: WorkflowExecutionRecord
  readonly variant: FrozenWorkflowComparisonVariant["variant"]
}): Effect.Effect<FrozenWorkflowComparisonVariant, WorkflowComparisonExecutionError, never> =>
  Effect.gen(function*() {
    const profile = yield* profileForRecord(record)
    const recordFingerprint = yield* fingerprintOf(record)

    return {
      variant,
      record,
      profile,
      recordFingerprint
    }
  })

export const frozenComparisonForRequest = (
  comparisonId: WorkflowComparisonId
): Effect.Effect<FrozenWorkflowComparisonRun, WorkflowComparisonExecutionError, never> =>
  workflowComparisonOptionById(comparisonId).pipe(
    Option.match({
      onNone: () => Effect.fail(invalidComparisonError(comparisonId)),
      onSome: (comparison) =>
        Effect.all({
          baseline: freezeVariant({ record: comparison.records.baseline, variant: "baseline" }),
          optimized: freezeVariant({ record: comparison.records.optimized, variant: "optimized" })
        }).pipe(
          Effect.map(({ baseline, optimized }) => ({
            entryId: comparison.entry.entryId,
            comparisonId: comparison.entry.comparisonId,
            label: comparison.label,
            summary: comparison.summary,
            workflowKind: comparison.workflowKind,
            authorities: comparison.authorities,
            baseline,
            optimized
          }))
        )
    })
  )

export const frozenWorkflowComparisonFingerprint = (
  comparison: FrozenWorkflowComparisonRun
): Effect.Effect<typeof DurableFingerprint.Type, never, never> =>
  fingerprintOf(encodeFrozenWorkflowComparisonRun(comparison))
