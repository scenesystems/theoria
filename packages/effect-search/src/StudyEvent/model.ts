/**
 * Study event model — tagged union of lifecycle events.
 *
 * @since 0.1.0
 */
export {
  /** @since 0.1.0 */
  BestUpdated,
  /** @since 0.1.0 */
  BestUpdatedSchema,
  /** @since 0.1.0 */
  BracketCompleted,
  /** @since 0.1.0 */
  BracketCompletedSchema,
  /** @since 0.1.0 */
  BracketStarted,
  /** @since 0.1.0 */
  BracketStartedSchema,
  /** @since 0.1.0 */
  CompletionReasonSchema,
  /** @since 0.1.0 */
  isStudyEvent,
  /** @since 0.1.0 */
  RoundCompleted,
  /** @since 0.1.0 */
  RoundCompletedSchema,
  /** @since 0.1.0 */
  RoundStarted,
  /** @since 0.1.0 */
  RoundStartedSchema,
  /** @since 0.1.0 */
  StudyCompleted,
  /** @since 0.1.0 */
  StudyCompletedSchema,
  /** @since 0.1.0 */
  StudyEventSchema,
  /** @since 0.1.0 */
  StudyStopRequested,
  /** @since 0.1.0 */
  StudyStopRequestedSchema,
  /** @since 0.1.0 */
  TrialCancelled,
  /** @since 0.1.0 */
  TrialCancelledSchema,
  /** @since 0.1.0 */
  TrialCompleted,
  /** @since 0.1.0 */
  TrialCompletedSchema,
  /** @since 0.1.0 */
  TrialCosted,
  /** @since 0.1.0 */
  TrialCostedSchema,
  /** @since 0.1.0 */
  TrialFailed,
  /** @since 0.1.0 */
  TrialFailedSchema,
  /** @since 0.1.0 */
  TrialPruned,
  /** @since 0.1.0 */
  TrialPrunedSchema,
  /** @since 0.1.0 */
  TrialReported,
  /** @since 0.1.0 */
  TrialReportedSchema,
  /** @since 0.1.0 */
  TrialRetried,
  /** @since 0.1.0 */
  TrialRetriedSchema,
  /** @since 0.1.0 */
  TrialStarted,
  /** @since 0.1.0 */
  TrialStartedSchema
} from "./model/schemas.js"

export type {
  /** @since 0.1.0 */ BestUpdated as BestUpdatedEvent,
  /** @since 0.1.0 */ BracketCompleted as BracketCompletedEvent,
  /** @since 0.1.0 */ BracketStarted as BracketStartedEvent,
  /** @since 0.1.0 */ CompletionReason,
  /** @since 0.1.0 */ RoundCompleted as RoundCompletedEvent,
  /** @since 0.1.0 */ RoundStarted as RoundStartedEvent,
  /** @since 0.1.0 */ StudyCompleted as StudyCompletedEvent,
  /** @since 0.1.0 */ StudyEvent,
  /** @since 0.1.0 */ StudyEventEncoded,
  /** @since 0.1.0 */ StudyStopRequested as StudyStopRequestedEvent,
  /** @since 0.1.0 */ TrialCancelled as TrialCancelledEvent,
  /** @since 0.1.0 */ TrialCompleted as TrialCompletedEvent,
  /** @since 0.1.0 */ TrialCosted as TrialCostedEvent,
  /** @since 0.1.0 */ TrialFailed as TrialFailedEvent,
  /** @since 0.1.0 */ TrialPruned as TrialPrunedEvent,
  /** @since 0.1.0 */ TrialReported as TrialReportedEvent,
  /** @since 0.1.0 */ TrialRetried as TrialRetriedEvent,
  /** @since 0.1.0 */ TrialStarted as TrialStartedEvent
} from "./model/schemas.js"

export {
  /** @since 0.1.0 */
  matchStudyEvent
} from "./model/match.js"
