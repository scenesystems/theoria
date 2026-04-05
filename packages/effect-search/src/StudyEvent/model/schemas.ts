/**
 * Schema definitions for all StudyEvent variants.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { ObjectiveValueSchema } from "../../contracts/ObjectiveValue.js"
import { TrialError } from "../../Errors/index.js"
import { SuggestionDiagnosticsSchema } from "../../Sampler/preparation.js"
import { PruneDecisionSchema, StopModeSchema } from "../../Study/runtime/pruning.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export const CompletionReasonSchema = Schema.Literal(
  "budgetExhausted",
  "spaceExhausted",
  "interrupted",
  "durationExceeded",
  "targetReached",
  "convergence",
  "noImprovement"
)

/**
 * @since 0.1.0
 * @category type-level
 */
export type CompletionReason = Schema.Schema.Type<typeof CompletionReasonSchema>

/** @since 0.1.0 @category schemas */
export const TrialStartedSchema = Schema.TaggedStruct("TrialStarted", {
  trialNumber: Schema.Number,
  config: Schema.Unknown,
  diagnostics: Schema.optional(SuggestionDiagnosticsSchema)
})

/** @since 0.1.0 @category schemas */
export const TrialReportedSchema = Schema.TaggedStruct("TrialReported", {
  trialNumber: Schema.Number,
  step: Schema.Number,
  value: Schema.Number,
  decision: PruneDecisionSchema
})

/** @since 0.1.0 @category schemas */
export const TrialCompletedSchema = Schema.TaggedStruct("TrialCompleted", {
  trialNumber: Schema.Number,
  value: ObjectiveValueSchema
})

/** @since 0.1.0 @category schemas */
export const TrialCostedSchema = Schema.TaggedStruct("TrialCosted", {
  trialNumber: Schema.Number,
  cost: Schema.Number,
  cumulativeCost: Schema.Number
})

/** @since 0.1.0 @category schemas */
export const TrialPrunedSchema = Schema.TaggedStruct("TrialPruned", {
  trialNumber: Schema.Number,
  step: Schema.Number,
  reason: Schema.String,
  policy: Schema.String
})

/** @since 0.1.0 @category schemas */
export const TrialRetriedSchema = Schema.TaggedStruct("TrialRetried", {
  trialNumber: Schema.Number,
  attempt: Schema.Number,
  error: TrialError
})

/** @since 0.1.0 @category schemas */
export const TrialCancelledSchema = Schema.TaggedStruct("TrialCancelled", {
  trialNumber: Schema.Number,
  reason: Schema.Literal("timeout")
})

/** @since 0.1.0 @category schemas */
export const TrialFailedSchema = Schema.TaggedStruct("TrialFailed", {
  trialNumber: Schema.Number,
  error: TrialError
})

/** @since 0.1.0 @category schemas */
export const BestUpdatedSchema = Schema.TaggedStruct("BestUpdated", {
  trialNumber: Schema.Number,
  value: Schema.Number
})

/** @since 0.1.0 @category schemas */
export const StudyStopRequestedSchema = Schema.TaggedStruct("StudyStopRequested", {
  mode: StopModeSchema,
  reason: Schema.String,
  requestedByTrialNumber: Schema.Number
})

/** @since 0.1.0 @category schemas */
export const BracketStartedSchema = Schema.TaggedStruct("BracketStarted", {
  bracketIndex: Schema.Number,
  configs: Schema.Number,
  minResource: Schema.Number
})

/** @since 0.1.0 @category schemas */
export const RoundStartedSchema = Schema.TaggedStruct("RoundStarted", {
  bracketIndex: Schema.Number,
  roundIndex: Schema.Number,
  nConfigs: Schema.Number,
  resource: Schema.Number
})

/** @since 0.1.0 @category schemas */
export const RoundCompletedSchema = Schema.TaggedStruct("RoundCompleted", {
  bracketIndex: Schema.Number,
  roundIndex: Schema.Number,
  nConfigs: Schema.Number,
  resource: Schema.Number,
  completed: Schema.Number
})

/** @since 0.1.0 @category schemas */
export const BracketCompletedSchema = Schema.TaggedStruct("BracketCompleted", {
  bracketIndex: Schema.Number,
  rounds: Schema.Number,
  bestValue: Schema.optional(Schema.Number)
})

/** @since 0.1.0 @category schemas */
export const StudyCompletedSchema = Schema.TaggedStruct("StudyCompleted", {
  completionReason: CompletionReasonSchema
})

/**
 * @since 0.1.0
 * @category schemas
 */
export const StudyEventSchema = Schema.Union(
  TrialStartedSchema,
  TrialReportedSchema,
  TrialCompletedSchema,
  TrialCostedSchema,
  TrialPrunedSchema,
  TrialRetriedSchema,
  TrialCancelledSchema,
  TrialFailedSchema,
  BestUpdatedSchema,
  StudyStopRequestedSchema,
  BracketStartedSchema,
  RoundStartedSchema,
  RoundCompletedSchema,
  BracketCompletedSchema,
  StudyCompletedSchema
)

/**
 * Tagged union of study lifecycle events.
 *
 * @since 0.1.0
 * @category models
 */
export type StudyEvent = Schema.Schema.Type<typeof StudyEventSchema>

/**
 * @since 0.1.0
 * @category guards
 */
export const isStudyEvent = Schema.is(StudyEventSchema)
