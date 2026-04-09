/**
 * Intermediate objective report recording and prune-decision event emission.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Match, Option, Ref } from "effect"

import { InvalidObjectiveReport } from "../../../Errors/index.js"
import * as StudyEvent from "../../../StudyEvent/index.js"
import type { EventRuntime } from "../../events.js"
import { appendEvent } from "../../events.js"
import {
  IntermediateReport,
  matchPruneDecision,
  type PrunedDecision,
  type PruneDecision,
  type PruningPolicy,
  PruningPolicyContext,
  PruningPolicySpi,
  PruningPolicySpiLayer
} from "../pruning.js"
import type { ReportRefs } from "./model.js"

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
  reports: ReadonlyArray<IntermediateReport>,
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
  reports: ReadonlyArray<IntermediateReport>,
  report: IntermediateReport
): ReadonlyArray<IntermediateReport> => Arr.append(reports, report)

const setPrunedDecision = (
  pruneRef: Ref.Ref<Option.Option<PrunedDecision>>,
  decision: PruneDecision
): Effect.Effect<void> =>
  matchPruneDecision({
    Continue: () => Effect.void,
    Prune: (pruned) =>
      Ref.update(pruneRef, (current) =>
        Option.match(current, {
          onNone: () => Option.some(pruned),
          onSome: () => current
        }))
  })(decision)

const recordIntermediateReportWithSpi = (
  runtime: EventRuntime,
  reportRefs: ReportRefs,
  trialNumber: number,
  step: number,
  value: number
): Effect.Effect<PruneDecision, InvalidObjectiveReport, PruningPolicySpi> =>
  Effect.gen(function*() {
    const reports = yield* Ref.get(reportRefs.reportsRef)
    yield* validateStep(trialNumber, step)
    yield* validateValue(trialNumber, step, value)
    yield* validateMonotonicStep(trialNumber, reports, step, value)

    const report = new IntermediateReport({ step, value })
    const nextReports = appendReport(reports, report)
    yield* Ref.set(reportRefs.reportsRef, nextReports)
    const policy = yield* PruningPolicySpi
    const decision = policy.decide(
      new PruningPolicyContext({
        trialNumber,
        reports: nextReports,
        latestReport: report
      })
    )

    yield* appendEvent(runtime, StudyEvent.TrialReported({ trialNumber, step, value, decision }))
    yield* setPrunedDecision(reportRefs.pruneRef, decision)

    return decision
  })

/**
 * Records a step/value intermediate report, applies the pruning policy, and emits a TrialReported event.
 *
 * @since 0.1.0
 * @category utils
 */
export const recordIntermediateReport = (
  runtime: EventRuntime,
  reportRefs: ReportRefs,
  trialNumber: number,
  pruningPolicy: PruningPolicy,
  step: number,
  value: number
): Effect.Effect<PruneDecision, InvalidObjectiveReport> =>
  recordIntermediateReportWithSpi(runtime, reportRefs, trialNumber, step, value).pipe(
    Effect.provide(PruningPolicySpiLayer(pruningPolicy))
  )
