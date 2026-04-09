/**
 * Pattern matching utilities for StudyEvent variants.
 *
 * @since 0.1.0
 */
import { Match } from "effect"

import type {
  BestUpdated as BestUpdatedEvent,
  BracketCompleted as BracketCompletedEvent,
  BracketStarted as BracketStartedEvent,
  RoundCompleted as RoundCompletedEvent,
  RoundStarted as RoundStartedEvent,
  StudyCompleted as StudyCompletedEvent,
  StudyEvent,
  StudyStopRequested as StudyStopRequestedEvent,
  TrialCancelled as TrialCancelledEvent,
  TrialCompleted as TrialCompletedEvent,
  TrialCosted as TrialCostedEvent,
  TrialFailed as TrialFailedEvent,
  TrialPruned as TrialPrunedEvent,
  TrialReported as TrialReportedEvent,
  TrialRetried as TrialRetriedEvent,
  TrialStarted as TrialStartedEvent
} from "./schemas.js"

/**
 * @since 0.1.0
 * @category pattern-matching
 */
export const matchStudyEvent = <A>(handlers: {
  readonly TrialStarted: (event: TrialStartedEvent) => A
  readonly TrialReported: (event: TrialReportedEvent) => A
  readonly TrialCompleted: (event: TrialCompletedEvent) => A
  readonly TrialCosted: (event: TrialCostedEvent) => A
  readonly TrialPruned: (event: TrialPrunedEvent) => A
  readonly TrialRetried: (event: TrialRetriedEvent) => A
  readonly TrialCancelled: (event: TrialCancelledEvent) => A
  readonly TrialFailed: (event: TrialFailedEvent) => A
  readonly BestUpdated: (event: BestUpdatedEvent) => A
  readonly StudyStopRequested: (event: StudyStopRequestedEvent) => A
  readonly BracketStarted: (event: BracketStartedEvent) => A
  readonly RoundStarted: (event: RoundStartedEvent) => A
  readonly RoundCompleted: (event: RoundCompletedEvent) => A
  readonly BracketCompleted: (event: BracketCompletedEvent) => A
  readonly StudyCompleted: (event: StudyCompletedEvent) => A
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
