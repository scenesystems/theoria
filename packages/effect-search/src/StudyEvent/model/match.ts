/**
 * Pattern matching utilities for StudyEvent variants.
 *
 * @since 0.1.0
 */
import type { Schema } from "effect"
import { Match } from "effect"

import type {
  BestUpdatedSchema,
  BracketCompletedSchema,
  BracketStartedSchema,
  RoundCompletedSchema,
  RoundStartedSchema,
  StudyCompletedSchema,
  StudyEvent,
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
 * @since 0.1.0
 * @category pattern-matching
 */
export const matchStudyEvent = <A>(handlers: {
  readonly TrialStarted: (event: Schema.Schema.Type<typeof TrialStartedSchema>) => A
  readonly TrialReported: (event: Schema.Schema.Type<typeof TrialReportedSchema>) => A
  readonly TrialCompleted: (event: Schema.Schema.Type<typeof TrialCompletedSchema>) => A
  readonly TrialCosted: (event: Schema.Schema.Type<typeof TrialCostedSchema>) => A
  readonly TrialPruned: (event: Schema.Schema.Type<typeof TrialPrunedSchema>) => A
  readonly TrialRetried: (event: Schema.Schema.Type<typeof TrialRetriedSchema>) => A
  readonly TrialCancelled: (event: Schema.Schema.Type<typeof TrialCancelledSchema>) => A
  readonly TrialFailed: (event: Schema.Schema.Type<typeof TrialFailedSchema>) => A
  readonly BestUpdated: (event: Schema.Schema.Type<typeof BestUpdatedSchema>) => A
  readonly StudyStopRequested: (event: Schema.Schema.Type<typeof StudyStopRequestedSchema>) => A
  readonly BracketStarted: (event: Schema.Schema.Type<typeof BracketStartedSchema>) => A
  readonly RoundStarted: (event: Schema.Schema.Type<typeof RoundStartedSchema>) => A
  readonly RoundCompleted: (event: Schema.Schema.Type<typeof RoundCompletedSchema>) => A
  readonly BracketCompleted: (event: Schema.Schema.Type<typeof BracketCompletedSchema>) => A
  readonly StudyCompleted: (event: Schema.Schema.Type<typeof StudyCompletedSchema>) => A
}) =>
(event: StudyEvent) =>
  Match.value(event).pipe(
    Match.tag("TrialStarted", handlers.TrialStarted),
    Match.tag("TrialReported", handlers.TrialReported),
    Match.tag("TrialCompleted", handlers.TrialCompleted),
    Match.tag("TrialCosted", handlers.TrialCosted),
    Match.tag("TrialPruned", handlers.TrialPruned),
    Match.tag("TrialRetried", handlers.TrialRetried),
    Match.tag("TrialCancelled", handlers.TrialCancelled),
    Match.tag("TrialFailed", handlers.TrialFailed),
    Match.tag("BestUpdated", handlers.BestUpdated),
    Match.tag("StudyStopRequested", handlers.StudyStopRequested),
    Match.tag("BracketStarted", handlers.BracketStarted),
    Match.tag("RoundStarted", handlers.RoundStarted),
    Match.tag("RoundCompleted", handlers.RoundCompleted),
    Match.tag("BracketCompleted", handlers.BracketCompleted),
    Match.tag("StudyCompleted", handlers.StudyCompleted),
    Match.exhaustive
  )
