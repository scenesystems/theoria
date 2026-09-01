/**
 * Smart constructors for creating StudyEvent instances.
 *
 * @since 0.1.0
 */
import type { Schema } from "effect"

import type { ObjectiveValue } from "../../contracts/ObjectiveValue.js"
import type { TrialError } from "../../Errors/index.js"
import type { PruneDecision, StopMode } from "../../Study/runtime/pruning.js"
import type {
  BestUpdatedSchema,
  BracketCompletedSchema,
  BracketStartedSchema,
  CompletionReason,
  RoundCompletedSchema,
  RoundStartedSchema,
  StudyCompletedSchema,
  StudyStopRequestedSchema,
  TrialCancelledSchema,
  TrialCompletedSchema,
  TrialCostedSchema,
  TrialFailedSchema,
  TrialPrunedSchema,
  TrialReportedSchema,
  TrialRetriedSchema,
  TrialStartedSchema
} from "./schemas.js"

/** Marks the point after reservation and before objective evaluation. @since 0.1.0 @category constructors */
export const TrialStarted = (fields: {
  readonly trialNumber: number
  readonly config: unknown
}): Schema.Schema.Type<typeof TrialStartedSchema> => ({
  _tag: "TrialStarted",
  ...fields
})

/** Captures the pruning decision made for one ordered intermediate report. @since 0.1.0 @category constructors */
export const TrialReported = (fields: {
  readonly trialNumber: number
  readonly step: number
  readonly value: number
  readonly decision: PruneDecision
}): Schema.Schema.Type<typeof TrialReportedSchema> => ({
  _tag: "TrialReported",
  ...fields
})

/** Marks successful objective evaluation as the trial's terminal outcome. @since 0.1.0 @category constructors */
export const TrialCompleted = (fields: {
  readonly trialNumber: number
  readonly value: ObjectiveValue
}): Schema.Schema.Type<typeof TrialCompletedSchema> => ({
  _tag: "TrialCompleted",
  ...fields
})

/** Accounts for one trial cost against the study's cumulative budget. @since 0.1.0 @category constructors */
export const TrialCosted = (fields: {
  readonly trialNumber: number
  readonly cost: number
  readonly cumulativeCost: number
}): Schema.Schema.Type<typeof TrialCostedSchema> => ({
  _tag: "TrialCosted",
  ...fields
})

/** Marks a policy-pruned trial as terminal at its last reported step. @since 0.1.0 @category constructors */
export const TrialPruned = (fields: {
  readonly trialNumber: number
  readonly step: number
  readonly reason: string
  readonly policy: string
}): Schema.Schema.Type<typeof TrialPrunedSchema> => ({
  _tag: "TrialPruned",
  ...fields
})

/** Records a failed attempt while leaving the trial eligible for its next attempt. @since 0.1.0 @category constructors */
export const TrialRetried = (fields: {
  readonly trialNumber: number
  readonly attempt: number
  readonly error: TrialError
}): Schema.Schema.Type<typeof TrialRetriedSchema> => ({
  _tag: "TrialRetried",
  ...fields
})

/** Marks timeout cancellation as the trial's terminal outcome. @since 0.1.0 @category constructors */
export const TrialCancelled = (fields: {
  readonly trialNumber: number
  readonly reason: "timeout"
}): Schema.Schema.Type<typeof TrialCancelledSchema> => ({
  _tag: "TrialCancelled",
  ...fields
})

/** Marks exhausted or non-retryable evaluation failure as terminal. @since 0.1.0 @category constructors */
export const TrialFailed = (fields: {
  readonly trialNumber: number
  readonly error: TrialError
}): Schema.Schema.Type<typeof TrialFailedSchema> => ({
  _tag: "TrialFailed",
  ...fields
})

/** Records replacement of the current scalar incumbent; Pareto studies do not use it. @since 0.1.0 @category constructors */
export const BestUpdated = (fields: {
  readonly trialNumber: number
  readonly value: number
}): Schema.Schema.Type<typeof BestUpdatedSchema> => ({
  _tag: "BestUpdated",
  ...fields
})

/** Records the first trial-owned stop request and whether in-flight work may continue. @since 0.1.0 @category constructors */
export const StudyStopRequested = (fields: {
  readonly mode: StopMode
  readonly reason: string
  readonly requestedByTrialNumber: number
}): Schema.Schema.Type<typeof StudyStopRequestedSchema> => ({
  _tag: "StudyStopRequested",
  ...fields
})

/** Marks allocation of a bracket's initial population and resource floor. @since 0.1.0 @category constructors */
export const BracketStarted = (fields: {
  readonly bracketIndex: number
  readonly configs: number
  readonly minResource: number
}): Schema.Schema.Type<typeof BracketStartedSchema> => ({
  _tag: "BracketStarted",
  ...fields
})

/** Marks assignment of a resource level to the round's surviving configs. @since 0.1.0 @category constructors */
export const RoundStarted = (fields: {
  readonly bracketIndex: number
  readonly roundIndex: number
  readonly nConfigs: number
  readonly resource: number
}): Schema.Schema.Type<typeof RoundStartedSchema> => ({
  _tag: "RoundStarted",
  ...fields
})

/** Closes a round with the number that reached its assigned resource. @since 0.1.0 @category constructors */
export const RoundCompleted = (fields: {
  readonly bracketIndex: number
  readonly roundIndex: number
  readonly nConfigs: number
  readonly resource: number
  readonly completed: number
}): Schema.Schema.Type<typeof RoundCompletedSchema> => ({
  _tag: "RoundCompleted",
  ...fields
})

/** Closes a bracket after all promotion rounds, retaining its scalar best when available. @since 0.1.0 @category constructors */
export const BracketCompleted = (fields: {
  readonly bracketIndex: number
  readonly rounds: number
  readonly bestValue?: number
}): Schema.Schema.Type<typeof BracketCompletedSchema> => ({
  _tag: "BracketCompleted",
  ...fields
})

/** Seals the event stream with the reason no further study work will be scheduled. @since 0.1.0 @category constructors */
export const StudyCompleted = (fields: {
  readonly completionReason: CompletionReason
}): Schema.Schema.Type<typeof StudyCompletedSchema> => ({
  _tag: "StudyCompleted",
  ...fields
})
