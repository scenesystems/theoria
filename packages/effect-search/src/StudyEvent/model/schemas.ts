/**
 * Schema definitions for all StudyEvent variants.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { ObjectiveValueSchema } from "../../contracts/ObjectiveValue.js"
import { TrialError } from "../../Errors/index.js"
import { PruneDecisionSchema, StopModeSchema } from "../../Study/runtime/pruning.js"

/**
 * Allowed reasons for ending a study.
 *
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
 * Reason recorded when a study completes.
 *
 * @since 0.1.0
 * @category type-level
 */
export type CompletionReason = Schema.Schema.Type<typeof CompletionReasonSchema>

/** Validates the trial number and configuration recorded when evaluation starts. @since 0.1.0 @category schemas */
export const TrialStartedSchema = Schema.TaggedStruct("TrialStarted", {
  trialNumber: Schema.Number,
  config: Schema.Unknown
})

/** Validates an intermediate trial measurement and its pruning decision. @since 0.1.0 @category schemas */
export const TrialReportedSchema = Schema.TaggedStruct("TrialReported", {
  trialNumber: Schema.Number,
  step: Schema.Number,
  value: Schema.Number,
  decision: PruneDecisionSchema
})

/** Validates a successfully completed trial and its objective value. @since 0.1.0 @category schemas */
export const TrialCompletedSchema = Schema.TaggedStruct("TrialCompleted", {
  trialNumber: Schema.Number,
  value: ObjectiveValueSchema
})

/** Validates a trial cost increment and the resulting cumulative cost. @since 0.1.0 @category schemas */
export const TrialCostedSchema = Schema.TaggedStruct("TrialCosted", {
  trialNumber: Schema.Number,
  cost: Schema.Number,
  cumulativeCost: Schema.Number
})

/** Validates the step, reason, and policy recorded for a pruned trial. @since 0.1.0 @category schemas */
export const TrialPrunedSchema = Schema.TaggedStruct("TrialPruned", {
  trialNumber: Schema.Number,
  step: Schema.Number,
  reason: Schema.String,
  policy: Schema.String
})

/** Validates a failed trial attempt that will be retried. @since 0.1.0 @category schemas */
export const TrialRetriedSchema = Schema.TaggedStruct("TrialRetried", {
  trialNumber: Schema.Number,
  attempt: Schema.Number,
  error: TrialError
})

/** Validates a trial cancelled because its evaluation timed out. @since 0.1.0 @category schemas */
export const TrialCancelledSchema = Schema.TaggedStruct("TrialCancelled", {
  trialNumber: Schema.Number,
  reason: Schema.Literal("timeout")
})

/** Validates a terminal trial failure and its structured error. @since 0.1.0 @category schemas */
export const TrialFailedSchema = Schema.TaggedStruct("TrialFailed", {
  trialNumber: Schema.Number,
  error: TrialError
})

/** Validates a scalar incumbent update attributed to a trial. @since 0.1.0 @category schemas */
export const BestUpdatedSchema = Schema.TaggedStruct("BestUpdated", {
  trialNumber: Schema.Number,
  value: Schema.Number
})

/** Validates a trial-triggered request to stop scheduling or cancel work. @since 0.1.0 @category schemas */
export const StudyStopRequestedSchema = Schema.TaggedStruct("StudyStopRequested", {
  mode: StopModeSchema,
  reason: Schema.String,
  requestedByTrialNumber: Schema.Number
})

/** Validates the initial configuration count and resource floor for a bracket. @since 0.1.0 @category schemas */
export const BracketStartedSchema = Schema.TaggedStruct("BracketStarted", {
  bracketIndex: Schema.Number,
  configs: Schema.Number,
  minResource: Schema.Number
})

/** Validates the configuration count and resource assigned when a bracket round starts. @since 0.1.0 @category schemas */
export const RoundStartedSchema = Schema.TaggedStruct("RoundStarted", {
  bracketIndex: Schema.Number,
  roundIndex: Schema.Number,
  nConfigs: Schema.Number,
  resource: Schema.Number
})

/** Validates completion counts for a bracket round at its assigned resource. @since 0.1.0 @category schemas */
export const RoundCompletedSchema = Schema.TaggedStruct("RoundCompleted", {
  bracketIndex: Schema.Number,
  roundIndex: Schema.Number,
  nConfigs: Schema.Number,
  resource: Schema.Number,
  completed: Schema.Number
})

/** Validates a completed bracket's round count and optional best value. @since 0.1.0 @category schemas */
export const BracketCompletedSchema = Schema.TaggedStruct("BracketCompleted", {
  bracketIndex: Schema.Number,
  rounds: Schema.Number,
  bestValue: Schema.optional(Schema.Number)
})

/** Validates the reason emitted when study execution ends. @since 0.1.0 @category schemas */
export const StudyCompletedSchema = Schema.TaggedStruct("StudyCompleted", {
  completionReason: CompletionReasonSchema
})

/**
 * Decodes the complete event stream vocabulary used by study execution and scheduling.
 *
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
 * Tests whether an unknown value is a valid study event.
 *
 * @since 0.1.0
 * @category guards
 */
export const isStudyEvent = Schema.is(StudyEventSchema)
