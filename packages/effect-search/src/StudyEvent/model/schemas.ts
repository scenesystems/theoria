/**
 * Schema definitions for all StudyEvent variants.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { ObjectiveValueSchema } from "../../contracts/ObjectiveValue.js"
import { SuggestionDiagnostics } from "../../contracts/SuggestionDiagnostics.js"
import { TrialError } from "../../Errors/index.js"
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

/** @since 0.3.0 @category schemas */
export class TrialStarted extends Schema.TaggedClass<TrialStarted>()("TrialStarted", {
  trialNumber: Schema.Number,
  config: Schema.Unknown,
  diagnostics: Schema.optional(SuggestionDiagnostics)
}) {}

/** @since 0.1.0 @category schemas */
export const TrialStartedSchema = TrialStarted

/** @since 0.3.0 @category schemas */
export class TrialReported extends Schema.TaggedClass<TrialReported>()("TrialReported", {
  trialNumber: Schema.Number,
  step: Schema.Number,
  value: Schema.Number,
  decision: PruneDecisionSchema
}) {}

/** @since 0.1.0 @category schemas */
export const TrialReportedSchema = TrialReported

/** @since 0.3.0 @category schemas */
export class TrialCompleted extends Schema.TaggedClass<TrialCompleted>()("TrialCompleted", {
  trialNumber: Schema.Number,
  value: ObjectiveValueSchema
}) {}

/** @since 0.1.0 @category schemas */
export const TrialCompletedSchema = TrialCompleted

/** @since 0.3.0 @category schemas */
export class TrialCosted extends Schema.TaggedClass<TrialCosted>()("TrialCosted", {
  trialNumber: Schema.Number,
  cost: Schema.Number,
  cumulativeCost: Schema.Number
}) {}

/** @since 0.1.0 @category schemas */
export const TrialCostedSchema = TrialCosted

/** @since 0.3.0 @category schemas */
export class TrialPruned extends Schema.TaggedClass<TrialPruned>()("TrialPruned", {
  trialNumber: Schema.Number,
  step: Schema.Number,
  reason: Schema.String,
  policy: Schema.String
}) {}

/** @since 0.1.0 @category schemas */
export const TrialPrunedSchema = TrialPruned

/** @since 0.3.0 @category schemas */
export class TrialRetried extends Schema.TaggedClass<TrialRetried>()("TrialRetried", {
  trialNumber: Schema.Number,
  attempt: Schema.Number,
  error: TrialError
}) {}

/** @since 0.1.0 @category schemas */
export const TrialRetriedSchema = TrialRetried

/** @since 0.3.0 @category schemas */
export class TrialCancelled extends Schema.TaggedClass<TrialCancelled>()("TrialCancelled", {
  trialNumber: Schema.Number,
  reason: Schema.Literal("timeout")
}) {}

/** @since 0.1.0 @category schemas */
export const TrialCancelledSchema = TrialCancelled

/** @since 0.3.0 @category schemas */
export class TrialFailed extends Schema.TaggedClass<TrialFailed>()("TrialFailed", {
  trialNumber: Schema.Number,
  error: TrialError
}) {}

/** @since 0.1.0 @category schemas */
export const TrialFailedSchema = TrialFailed

/** @since 0.3.0 @category schemas */
export class BestUpdated extends Schema.TaggedClass<BestUpdated>()("BestUpdated", {
  trialNumber: Schema.Number,
  value: Schema.Number
}) {}

/** @since 0.1.0 @category schemas */
export const BestUpdatedSchema = BestUpdated

/** @since 0.3.0 @category schemas */
export class StudyStopRequested extends Schema.TaggedClass<StudyStopRequested>()("StudyStopRequested", {
  mode: StopModeSchema,
  reason: Schema.String,
  requestedByTrialNumber: Schema.Number
}) {}

/** @since 0.1.0 @category schemas */
export const StudyStopRequestedSchema = StudyStopRequested

/** @since 0.3.0 @category schemas */
export class BracketStarted extends Schema.TaggedClass<BracketStarted>()("BracketStarted", {
  bracketIndex: Schema.Number,
  configs: Schema.Number,
  minResource: Schema.Number
}) {}

/** @since 0.1.0 @category schemas */
export const BracketStartedSchema = BracketStarted

/** @since 0.3.0 @category schemas */
export class RoundStarted extends Schema.TaggedClass<RoundStarted>()("RoundStarted", {
  bracketIndex: Schema.Number,
  roundIndex: Schema.Number,
  nConfigs: Schema.Number,
  resource: Schema.Number
}) {}

/** @since 0.1.0 @category schemas */
export const RoundStartedSchema = RoundStarted

/** @since 0.3.0 @category schemas */
export class RoundCompleted extends Schema.TaggedClass<RoundCompleted>()("RoundCompleted", {
  bracketIndex: Schema.Number,
  roundIndex: Schema.Number,
  nConfigs: Schema.Number,
  resource: Schema.Number,
  completed: Schema.Number
}) {}

/** @since 0.1.0 @category schemas */
export const RoundCompletedSchema = RoundCompleted

/** @since 0.3.0 @category schemas */
export class BracketCompleted extends Schema.TaggedClass<BracketCompleted>()("BracketCompleted", {
  bracketIndex: Schema.Number,
  rounds: Schema.Number,
  bestValue: Schema.optional(Schema.Number)
}) {}

/** @since 0.1.0 @category schemas */
export const BracketCompletedSchema = BracketCompleted

/** @since 0.3.0 @category schemas */
export class StudyCompleted extends Schema.TaggedClass<StudyCompleted>()("StudyCompleted", {
  completionReason: CompletionReasonSchema
}) {}

/** @since 0.1.0 @category schemas */
export const StudyCompletedSchema = StudyCompleted

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

/** @since 0.1.0 @category type-level */
export type StudyEventEncoded = Schema.Schema.Encoded<typeof StudyEventSchema>

/**
 * @since 0.1.0
 * @category guards
 */
export const isStudyEvent = Schema.is(StudyEventSchema)
