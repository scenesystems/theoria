/**
 * Event payloads emitted by study execution, ask/tell sessions, and bracket
 * schedulers. A streaming study that closes normally ends with
 * `StudyCompleted`. Failed and pruned trial outcomes appear in the stream as
 * tagged events.
 *
 * @since 0.1.0
 */
export {
  BestUpdated,
  BestUpdatedSchema,
  BracketCompleted,
  BracketCompletedSchema,
  BracketStarted,
  BracketStartedSchema,
  type CompletionReason,
  CompletionReasonSchema,
  isStudyEvent,
  matchStudyEvent,
  RoundCompleted,
  RoundCompletedSchema,
  RoundStarted,
  RoundStartedSchema,
  StudyCompleted,
  StudyCompletedSchema,
  type StudyEvent,
  StudyEventSchema,
  StudyStopRequested,
  StudyStopRequestedSchema,
  TrialCancelled,
  TrialCancelledSchema,
  TrialCompleted,
  TrialCompletedSchema,
  TrialCosted,
  TrialCostedSchema,
  TrialFailed,
  TrialFailedSchema,
  TrialPruned,
  TrialPrunedSchema,
  TrialReported,
  TrialReportedSchema,
  TrialRetried,
  TrialRetriedSchema,
  TrialStarted,
  TrialStartedSchema
} from "./model.js"
