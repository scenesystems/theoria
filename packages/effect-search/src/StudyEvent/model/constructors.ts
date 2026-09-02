/**
 * Plain-object constructors for study events. Each function adds its event tag
 * and leaves validation to the corresponding schema.
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

/**
 * Creates the event emitted after reservation and before objective evaluation.
 *
 * @since 0.1.0
 * @category constructors
 */
export const TrialStarted = (fields: {
  readonly trialNumber: number
  readonly config: unknown
}): Schema.Schema.Type<typeof TrialStartedSchema> => ({
  _tag: "TrialStarted",
  ...fields
})

/**
 * Creates an event for an accepted intermediate value and its pruning decision.
 *
 * @since 0.1.0
 * @category constructors
 */
export const TrialReported = (fields: {
  readonly trialNumber: number
  readonly step: number
  readonly value: number
  readonly decision: PruneDecision
}): Schema.Schema.Type<typeof TrialReportedSchema> => ({
  _tag: "TrialReported",
  ...fields
})

/**
 * Creates the terminal event for a successful objective evaluation.
 *
 * @since 0.1.0
 * @category constructors
 */
export const TrialCompleted = (fields: {
  readonly trialNumber: number
  readonly value: ObjectiveValue
}): Schema.Schema.Type<typeof TrialCompletedSchema> => ({
  _tag: "TrialCompleted",
  ...fields
})

/**
 * Creates an event for one trial cost and the cumulative total that includes it.
 *
 * @since 0.1.0
 * @category constructors
 */
export const TrialCosted = (fields: {
  readonly trialNumber: number
  readonly cost: number
  readonly cumulativeCost: number
}): Schema.Schema.Type<typeof TrialCostedSchema> => ({
  _tag: "TrialCosted",
  ...fields
})

/**
 * Creates the terminal event for a trial stopped by its pruning policy.
 *
 * @since 0.1.0
 * @category constructors
 */
export const TrialPruned = (fields: {
  readonly trialNumber: number
  readonly step: number
  readonly reason: string
  readonly policy: string
}): Schema.Schema.Type<typeof TrialPrunedSchema> => ({
  _tag: "TrialPruned",
  ...fields
})

/**
 * Creates an event after a failed attempt is accepted for retry. `attempt`
 * identifies the next attempt and starts at one.
 *
 * @since 0.1.0
 * @category constructors
 */
export const TrialRetried = (fields: {
  readonly trialNumber: number
  readonly attempt: number
  readonly error: TrialError
}): Schema.Schema.Type<typeof TrialRetriedSchema> => ({
  _tag: "TrialRetried",
  ...fields
})

/**
 * Creates the terminal timeout event after objective interruption.
 *
 * @since 0.1.0
 * @category constructors
 */
export const TrialCancelled = (fields: {
  readonly trialNumber: number
  readonly reason: "timeout"
}): Schema.Schema.Type<typeof TrialCancelledSchema> => ({
  _tag: "TrialCancelled",
  ...fields
})

/**
 * Creates the terminal event for a trial error that will not be retried.
 *
 * @since 0.1.0
 * @category constructors
 */
export const TrialFailed = (fields: {
  readonly trialNumber: number
  readonly error: TrialError
}): Schema.Schema.Type<typeof TrialFailedSchema> => ({
  _tag: "TrialFailed",
  ...fields
})

/**
 * Creates an event for a new scalar incumbent. Multi-objective studies use
 * Pareto results and do not emit this event.
 *
 * @since 0.1.0
 * @category constructors
 */
export const BestUpdated = (fields: {
  readonly trialNumber: number
  readonly value: number
}): Schema.Schema.Type<typeof BestUpdatedSchema> => ({
  _tag: "BestUpdated",
  ...fields
})

/**
 * Creates an event for the trial-owned stop request currently selected by the
 * study and its effect on active work.
 *
 * @since 0.1.0
 * @category constructors
 */
export const StudyStopRequested = (fields: {
  readonly mode: StopMode
  readonly reason: string
  readonly requestedByTrialNumber: number
}): Schema.Schema.Type<typeof StudyStopRequestedSchema> => ({
  _tag: "StudyStopRequested",
  ...fields
})

/**
 * Creates an event before a bracket's initial configurations are suggested.
 *
 * @since 0.1.0
 * @category constructors
 */
export const BracketStarted = (fields: {
  readonly bracketIndex: number
  readonly configs: number
  readonly minResource: number
}): Schema.Schema.Type<typeof BracketStartedSchema> => ({
  _tag: "BracketStarted",
  ...fields
})

/**
 * Creates an event before a scheduler round evaluates its assigned configurations.
 *
 * @since 0.1.0
 * @category constructors
 */
export const RoundStarted = (fields: {
  readonly bracketIndex: number
  readonly roundIndex: number
  readonly nConfigs: number
  readonly resource: number
}): Schema.Schema.Type<typeof RoundStartedSchema> => ({
  _tag: "RoundStarted",
  ...fields
})

/**
 * Creates an event after a round, including the number of scalar successful
 * trials available for ranking.
 *
 * @since 0.1.0
 * @category constructors
 */
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

/**
 * Creates an event after all rounds in a bracket, with its scalar best when one
 * was observed.
 *
 * @since 0.1.0
 * @category constructors
 */
export const BracketCompleted = (fields: {
  readonly bracketIndex: number
  readonly rounds: number
  readonly bestValue?: number
}): Schema.Schema.Type<typeof BracketCompletedSchema> => ({
  _tag: "BracketCompleted",
  ...fields
})

/**
 * Creates the final event with the reason no further study work will be admitted.
 *
 * @since 0.1.0
 * @category constructors
 */
export const StudyCompleted = (fields: {
  readonly completionReason: CompletionReason
}): Schema.Schema.Type<typeof StudyCompletedSchema> => ({
  _tag: "StudyCompleted",
  ...fields
})
