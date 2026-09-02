/**
 * Runtime decoding for study events. Individual schemas validate payload
 * shape; they do not validate event order or relationships between events.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { ObjectiveValueSchema } from "../../contracts/ObjectiveValue.js"
import { TrialError } from "../../Errors/index.js"
import { PruneDecisionSchema, StopModeSchema } from "../../Study/runtime/pruning.js"

/**
 * Decodes the terminal status shared by study results and `StudyCompleted`.
 * `budgetExhausted` covers normal completion of the configured trial count as
 * well as the optional cost budget. Ask/tell sessions may close with any member
 * of the union.
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
 * Identifies why study execution stopped admitting trials.
 *
 * @since 0.1.0
 * @category type-level
 */
export type CompletionReason = Schema.Schema.Type<typeof CompletionReasonSchema>

/**
 * Decodes the reservation event emitted immediately before objective
 * evaluation. The configuration remains `unknown` and is not decoded against
 * the search space.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TrialStartedSchema = Schema.TaggedStruct("TrialStarted", {
  trialNumber: Schema.Number,
  config: Schema.Unknown
})

/**
 * Decodes an accepted intermediate measurement together with the pruning
 * decision made from it.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TrialReportedSchema = Schema.TaggedStruct("TrialReported", {
  trialNumber: Schema.Number,
  step: Schema.Number,
  value: Schema.Number,
  decision: PruneDecisionSchema
})

/**
 * Decodes the terminal event for a successful objective evaluation. Retry,
 * duration, variance, and cost metadata remain on the trial record.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TrialCompletedSchema = Schema.TaggedStruct("TrialCompleted", {
  trialNumber: Schema.Number,
  value: ObjectiveValueSchema
})

/**
 * Decodes the cost reported by one trial and the study total after adding it.
 * The schema does not constrain the unit, sign, or finiteness of either number.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TrialCostedSchema = Schema.TaggedStruct("TrialCosted", {
  trialNumber: Schema.Number,
  cost: Schema.Number,
  cumulativeCost: Schema.Number
})

/**
 * Decodes the terminal event produced when a pruning policy stops evaluation.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TrialPrunedSchema = Schema.TaggedStruct("TrialPruned", {
  trialNumber: Schema.Number,
  step: Schema.Number,
  reason: Schema.String,
  policy: Schema.String
})

/**
 * Decodes a failed objective attempt after its retry schedule accepts another
 * attempt. `attempt` is the one-based number of the attempt about to run.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TrialRetriedSchema = Schema.TaggedStruct("TrialRetried", {
  trialNumber: Schema.Number,
  attempt: Schema.Number,
  error: TrialError
})

/**
 * Decodes the terminal timeout event. Objective interruption uses this event
 * instead of `TrialFailed`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TrialCancelledSchema = Schema.TaggedStruct("TrialCancelled", {
  trialNumber: Schema.Number,
  reason: Schema.Literal("timeout")
})

/**
 * Decodes the terminal error emitted after retries are unavailable or the
 * objective result fails validation.
 *
 * @since 0.1.0
 * @category schemas
 */
export const TrialFailedSchema = Schema.TaggedStruct("TrialFailed", {
  trialNumber: Schema.Number,
  error: TrialError
})

/**
 * Decodes a strict incumbent improvement in a single-objective study. The first
 * successful scalar trial establishes the initial incumbent. Multi-objective
 * studies do not emit this event.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BestUpdatedSchema = Schema.TaggedStruct("BestUpdated", {
  trialNumber: Schema.Number,
  value: Schema.Number
})

/**
 * Decodes a trial-owned stop request selected by the study. `Drain` stops new
 * work while active trials finish; `Interrupt` also asks active objectives to
 * stop at their next heartbeat.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StudyStopRequestedSchema = Schema.TaggedStruct("StudyStopRequested", {
  mode: StopModeSchema,
  reason: Schema.String,
  requestedByTrialNumber: Schema.Number
})

/**
 * Decodes the scheduler event emitted before a bracket's initial configurations
 * are suggested.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BracketStartedSchema = Schema.TaggedStruct("BracketStarted", {
  bracketIndex: Schema.Number,
  configs: Schema.Number,
  minResource: Schema.Number
})

/**
 * Decodes the scheduler event that assigns a resource level to one bracket
 * round.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RoundStartedSchema = Schema.TaggedStruct("RoundStarted", {
  bracketIndex: Schema.Number,
  roundIndex: Schema.Number,
  nConfigs: Schema.Number,
  resource: Schema.Number
})

/**
 * Decodes the end of a scheduler round. `completed` counts scalar successful
 * trials eligible for ranking, which may be fewer than `nConfigs`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const RoundCompletedSchema = Schema.TaggedStruct("RoundCompleted", {
  bracketIndex: Schema.Number,
  roundIndex: Schema.Number,
  nConfigs: Schema.Number,
  resource: Schema.Number,
  completed: Schema.Number
})

/**
 * Decodes the end of a bracket. `bestValue` is absent when no round produced a
 * scalar successful result.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BracketCompletedSchema = Schema.TaggedStruct("BracketCompleted", {
  bracketIndex: Schema.Number,
  rounds: Schema.Number,
  bestValue: Schema.optional(Schema.Number)
})

/**
 * Decodes the final event emitted when a study or ask/tell session closes.
 *
 * @since 0.1.0
 * @category schemas
 */
export const StudyCompletedSchema = Schema.TaggedStruct("StudyCompleted", {
  completionReason: CompletionReasonSchema
})

/**
 * Decodes any public study event. Validation covers one payload in isolation;
 * it does not establish that the event could occur at its position in a stream.
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
 * Carries trial outcomes, stopping decisions, scheduler progress, or study
 * completion in the event stream.
 *
 * @since 0.1.0
 * @category models
 */
export type StudyEvent = Schema.Schema.Type<typeof StudyEventSchema>

/**
 * Tests an unknown value against {@link StudyEventSchema} and narrows successful
 * inputs to {@link StudyEvent}.
 *
 * @since 0.1.0
 * @category guards
 */
export const isStudyEvent = Schema.is(StudyEventSchema)
