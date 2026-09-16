/**
 * Intermediate objective report recording and prune-decision event emission.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Match, Option, Ref } from "effect"

import {
  Context as PruningContext,
  type Decision,
  matchDecision,
  type Policy,
  type Pruned,
  Report
} from "../../../../Pruning.js"
import { type ArtifactStorageError, InvalidObjectiveReport } from "../../../../SearchError.js"
import * as StudyEvent from "../../../../StudyEvent.js"
import type { EventRuntime } from "../../events.js"
import { appendEvent } from "../../events.js"
import { ReportRefs } from "./reportState.js"

const reportError = (
  trialNumber: number,
  reason: string,
  step?: number,
  value?: number,
  previousStep?: number
): InvalidObjectiveReport =>
  new InvalidObjectiveReport({
    trialNumber,
    reason,
    ...Option.fromNullable(step).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (resolvedStep) => ({ step: resolvedStep })
      })
    ),
    ...Option.fromNullable(value).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (resolvedValue) => ({ value: resolvedValue })
      })
    ),
    ...Option.fromNullable(previousStep).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (resolvedPreviousStep) => ({ previousStep: resolvedPreviousStep })
      })
    )
  })

const validateStep = (trialNumber: number, step: number): Effect.Effect<void, InvalidObjectiveReport> =>
  Match.value(Number.isInteger(step) && step >= 0).pipe(
    Match.when(true, () => Effect.void),
    Match.orElse(() => Effect.fail(reportError(trialNumber, "step must be a non-negative integer", step)))
  )

const validateValue = (
  trialNumber: number,
  step: number,
  value: number
): Effect.Effect<void, InvalidObjectiveReport> =>
  Match.value(Number.isFinite(value)).pipe(
    Match.when(true, () => Effect.void),
    Match.orElse(() => Effect.fail(reportError(trialNumber, "value must be finite", step, value)))
  )

const validateMonotonicStep = (
  trialNumber: number,
  reports: ReadonlyArray<Report>,
  step: number,
  value: number
): Effect.Effect<void, InvalidObjectiveReport> =>
  Arr.last(reports).pipe(
    Option.match({
      onNone: () => Effect.void,
      onSome: ({ step: previousStep }) =>
        Match.value(step > previousStep).pipe(
          Match.when(true, () => Effect.void),
          Match.orElse(() =>
            Match.value(step === previousStep).pipe(
              Match.when(
                true,
                () => Effect.fail(reportError(trialNumber, "duplicate-step", step, value, previousStep))
              ),
              Match.orElse(() => Effect.fail(reportError(trialNumber, "non-monotone-step", step, value, previousStep)))
            )
          )
        )
    })
  )

const appendReport = (
  reports: ReadonlyArray<Report>,
  report: Report
): ReadonlyArray<Report> => Arr.append(reports, report)

const setPruned = (
  pruneRef: Ref.Ref<Option.Option<Pruned>>,
  decision: Decision
): Effect.Effect<void> =>
  matchDecision({
    Continue: () => Effect.void,
    Prune: (pruned) =>
      Ref.update(pruneRef, (current) =>
        Option.match(current, {
          onNone: () => Option.some(pruned),
          onSome: () => current
        }))
  })(decision)

/**
 * Creates fresh report refs for a single trial, with empty reports and no prune decision.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeReportRefs: Effect.Effect<ReportRefs> = Effect.gen(function*() {
  return new ReportRefs({
    reportsRef: yield* Ref.make<ReadonlyArray<Report>>([]),
    pruneRef: yield* Ref.make<Option.Option<Pruned>>(Option.none())
  })
})

const recordReportWithSpi = (
  runtime: EventRuntime,
  reportRefs: ReportRefs,
  trialNumber: number,
  step: number,
  value: number,
  policy: Policy
): Effect.Effect<Decision, InvalidObjectiveReport | ArtifactStorageError> =>
  Effect.gen(function*() {
    const reports = yield* Ref.get(reportRefs.reportsRef)
    yield* validateStep(trialNumber, step)
    yield* validateValue(trialNumber, step, value)
    yield* validateMonotonicStep(trialNumber, reports, step, value)

    const report = new Report({ step, value })
    const nextReports = appendReport(reports, report)
    yield* Ref.set(reportRefs.reportsRef, nextReports)
    const decision = policy.decide(
      new PruningContext({
        trialNumber,
        reports: nextReports,
        latestReport: report
      })
    )

    yield* appendEvent(runtime, StudyEvent.trialReported({ trialNumber, step, value, decision }))
    yield* setPruned(reportRefs.pruneRef, decision)

    return decision
  })

/**
 * Records a step/value intermediate report, applies the pruning policy, and emits a TrialReported event.
 *
 * @since 0.1.0
 * @category utils
 */
export const recordReport = (
  runtime: EventRuntime,
  reportRefs: ReportRefs,
  trialNumber: number,
  pruningPolicy: Policy,
  step: number,
  value: number
): Effect.Effect<Decision, InvalidObjectiveReport | ArtifactStorageError> =>
  recordReportWithSpi(runtime, reportRefs, trialNumber, step, value, pruningPolicy)
