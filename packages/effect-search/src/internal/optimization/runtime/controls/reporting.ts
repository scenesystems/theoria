/**
 * Records intermediate objective reports and emits prune-decision events.
 *
 * @since 0.1.0
 */
import { isFinite } from "@scenesystems/effect-math/Numeric"
import type * as Journal from "@scenesystems/effect-study/Journal"
import { Array as Arr, Boolean as Bool, Effect, Match, Number as Num, Option, Ref, Schema } from "effect"

import * as OptimizationEvent from "../../../../OptimizationEvent.js"
import {
  Context as PruningContext,
  type Decision,
  matchDecision,
  type Policy,
  type Pruned,
  Report
} from "../../../../Pruning.js"
import { InvalidObjectiveReport } from "../../../../SearchError.js"
import type { EventRuntime } from "../../events.js"
import { appendEvent } from "../../events.js"
import { ReportRefs, type Reports } from "./reportState.js"

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
  Match.value(Bool.and(Schema.is(Schema.Number.pipe(Schema.int()))(step), Num.greaterThanOrEqualTo(step, 0))).pipe(
    Match.when(true, () => Effect.void),
    Match.orElse(() => Effect.fail(reportError(trialNumber, "step must be a non-negative integer", step)))
  )

const validateValue = (
  trialNumber: number,
  step: number,
  value: number
): Effect.Effect<void, InvalidObjectiveReport> =>
  Match.value(isFinite(value)).pipe(
    Match.when(true, () => Effect.void),
    Match.orElse(() => Effect.fail(reportError(trialNumber, "value must be finite", step, value)))
  )

const validateMonotonicStep = (
  trialNumber: number,
  reports: Reports,
  step: number,
  value: number
): Effect.Effect<void, InvalidObjectiveReport> =>
  Arr.last(reports).pipe(
    Option.match({
      onNone: () => Effect.void,
      onSome: ({ step: previousStep }) =>
        Match.value(Num.greaterThan(step, previousStep)).pipe(
          Match.when(true, () => Effect.void),
          Match.orElse(() =>
            Match.value(Num.Equivalence(step, previousStep)).pipe(
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
  reports: Reports,
  report: Report
): Reports => Arr.append(reports, report)

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
    reportsRef: yield* Ref.make<Reports>(Arr.empty()),
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
): Effect.Effect<Decision, InvalidObjectiveReport | Journal.Failure> =>
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

    yield* appendEvent(runtime, OptimizationEvent.TrialReported({ trialNumber, step, value, decision }))
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
): Effect.Effect<Decision, InvalidObjectiveReport | Journal.Failure> =>
  recordReportWithSpi(runtime, reportRefs, trialNumber, step, value, pruningPolicy)
