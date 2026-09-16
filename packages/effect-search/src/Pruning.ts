/**
 * Ordered intermediate reports, pruning policies, and objective trial controls.
 *
 * @since 0.7.0
 * @module
 */
import type * as Stop from "@scenesystems/effect-study/Stop"
import { Array as Arr, Boolean as Bool, Data, Match, Number as Num, Option, Schema } from "effect"
import type { Effect } from "effect"

import { Direction } from "./Direction.js"
import type { ArtifactStorageError, InvalidObjectiveReport } from "./SearchError.js"

/** One accepted intermediate objective value. @since 0.7.0 @category schemas */
export class Report extends Schema.Class<Report>("effect-search/Pruning/Report")({
  step: Schema.NonNegativeInt,
  value: Schema.JsonNumber
}) {}

const Reports = Schema.Array(Report)

/** Continue evaluation or prune it with provenance. @since 0.7.0 @category schemas */
export const Decision = Schema.Union(
  Schema.TaggedStruct("Continue", {}),
  Schema.TaggedStruct("Prune", {
    step: Schema.NonNegativeInt,
    reason: Schema.String,
    policy: Schema.String
  })
)
/** Decoded instruction to continue or prune an evaluation. @since 0.7.0 @category models */
export type Decision = typeof Decision.Type
/** Terminal pruning decision with its step, reason, and policy. @since 0.7.0 @category models */
export type Pruned = Data.TaggedEnum.Value<Decision, "Prune">

const Decisions = Data.taggedEnum<Decision>()
/** Keeps an evaluation running. @since 0.7.0 @category constructors */
export const continueEvaluation = Decisions.Continue
/** Stops an evaluation under a pruning policy. @since 0.7.0 @category constructors */
export const prune = Decisions.Prune
/** Narrows a pruning decision. @since 0.7.0 @category guards */
export const isDecision = Decisions.$is
/** Exhaustively matches a pruning decision. @since 0.7.0 @category pattern-matching */
export const matchDecision = Decisions.$match

/** Inputs supplied to a pruning policy in ascending step order. @since 0.7.0 @category models */
export class Context extends Data.Class<{
  readonly trialNumber: number
  readonly reports: Iterable<Report>
  readonly latestReport: Report
}> {}

/** A deterministic, independently selectable pruning policy. @since 0.7.0 @category models */
export class Policy extends Data.Class<{
  readonly name: string
  readonly decide: (context: Context) => Decision
}> {}

/** Policy that never prunes. @since 0.7.0 @category constructors */
export const never = new Policy({ name: "never-prune", decide: () => continueEvaluation() })

const directionFactor = (direction: Direction): number =>
  Match.value(direction).pipe(
    Match.when("minimize", () => 1),
    Match.when("maximize", () => -1),
    Match.exhaustive
  )

/** Creates a threshold policy. @since 0.7.0 @category constructors */
export const threshold = (limit: number, direction: Direction = "minimize", minStep = 0): Policy =>
  new Policy({
    name: "threshold",
    decide: ({ latestReport }) =>
      Match.value(Num.lessThan(latestReport.step, minStep)).pipe(
        Match.when(true, () => continueEvaluation()),
        Match.orElse(() =>
          Match.value(
            Num.greaterThanOrEqualTo(
              Num.multiply(latestReport.value, directionFactor(direction)),
              Num.multiply(limit, directionFactor(direction))
            )
          ).pipe(
            Match.when(true, () =>
              prune({
                step: latestReport.step,
                reason: `threshold(${limit})`,
                policy: "threshold"
              })),
            Match.orElse(() => continueEvaluation())
          )
        )
      )
  })

/** Controls available to one running objective. @since 0.7.0 @category models */
export class Runtime extends Data.Class<{
  readonly report: (
    step: number,
    value: number
  ) => Effect.Effect<Decision, InvalidObjectiveReport | ArtifactStorageError>
  readonly heartbeat: Effect.Effect<Stop.Decision>
  readonly requestStop: (reason?: string) => Effect.Effect<void, ArtifactStorageError>
  readonly resource: Effect.Effect<Option.Option<number>>
}> {}

/** Settings for percentile pruning. @since 0.7.0 @category schemas */
export class PercentileOptions extends Schema.Class<PercentileOptions>("effect-search/Pruning/PercentileOptions")({
  percentile: Schema.Number,
  startupTrials: Schema.Number,
  warmupSteps: Schema.Number,
  intervalSteps: Schema.Number,
  nMinTrials: Schema.Number
}) {}

/** Historical report state used by percentile pruning. @since 0.7.0 @category schemas */
export const PercentileTrialState = Schema.Literal("complete", "pruned", "running")
/** Lifecycle state of a trial in percentile-pruning history. @since 0.7.0 @category models */
export type PercentileTrialState = typeof PercentileTrialState.Type

/** Historical reports used by percentile pruning. @since 0.7.0 @category schemas */
export class PercentileTrial extends Schema.Class<PercentileTrial>("effect-search/Pruning/PercentileTrial")({
  trialNumber: Schema.Number,
  state: PercentileTrialState,
  reports: Schema.Array(Report)
}) {}

const PercentileTrials = Schema.Array(PercentileTrial)

/** Inputs to one percentile pruning decision. @since 0.7.0 @category schemas */
export class PercentileContext extends Schema.Class<PercentileContext>("effect-search/Pruning/PercentileContext")({
  direction: Direction,
  settings: PercentileOptions,
  trialNumber: Schema.Number,
  step: Schema.Number,
  history: PercentileTrials,
  currentReports: Reports
}) {}

const finiteValues = (values: Iterable<number>) => Arr.filter(values, (value) => Number.isFinite(value))

const percentileValue = (values: Iterable<number>, percentile: number): Option.Option<number> => {
  const ordered = Arr.sort(finiteValues(values), Num.Order)
  return Arr.head(ordered).pipe(
    Option.map(() => {
      const rank = Num.multiply(
        Num.unsafeDivide(Num.clamp(percentile, { minimum: 0, maximum: 100 }), 100),
        Num.decrement(Arr.length(ordered))
      )
      const lowerIndex = Math.floor(rank)
      const upperIndex = Math.ceil(rank)
      const lower = Arr.get(ordered, lowerIndex).pipe(Option.getOrElse(() => Number.NaN))
      const upper = Arr.get(ordered, upperIndex).pipe(Option.getOrElse(() => Number.NaN))
      return Num.sum(lower, Num.multiply(Num.subtract(upper, lower), Num.subtract(rank, lowerIndex)))
    })
  )
}

const bestReport = (reports: Iterable<Report>, direction: Direction): Option.Option<number> => {
  const values = finiteValues(Arr.map(Arr.fromIterable(reports), (report) => report.value))
  return Arr.head(values).pipe(
    Option.map(() =>
      Match.value(direction).pipe(
        Match.when("maximize", () => Arr.reduce(values, Number.NEGATIVE_INFINITY, Num.max)),
        Match.when("minimize", () => Arr.reduce(values, Number.POSITIVE_INFINITY, Num.min)),
        Match.exhaustive
      )
    )
  )
}

/** Evaluates a percentile pruning rule after all schedule gates pass. @since 0.7.0 @category guards */
export const shouldPruneByPercentile = (context: PercentileContext): boolean => {
  const completed = Arr.filter(context.history, (trial) =>
    Match.value(trial.state).pipe(
      Match.when("complete", () => true),
      Match.orElse(() => false)
    ))
  const intervalSteps = Match.value(Num.greaterThan(context.settings.intervalSteps, 0)).pipe(
    Match.when(true, () => Math.floor(context.settings.intervalSteps)),
    Match.orElse(() => 1)
  )
  const interval = Num.subtract(context.step, context.settings.warmupSteps)
  const nearestLower = Num.sum(
    Num.multiply(Math.floor(Num.unsafeDivide(interval, intervalSteps)), intervalSteps),
    context.settings.warmupSteps
  )
  const previousStep = Arr.reduce(
    context.currentReports,
    -1,
    (current, report) =>
      Match.value(Bool.and(
        Bool.not(Num.Equivalence(report.step, context.step)),
        Num.greaterThan(report.step, current)
      )).pipe(
        Match.when(true, () => report.step),
        Match.orElse(() => current)
      )
  )
  const peers = Arr.filterMap(
    completed,
    (trial) =>
      Arr.findFirst(trial.reports, (report) => Num.Equivalence(report.step, context.step)).pipe(
        Option.map((report) => report.value)
      )
  )
  const eligible = Arr.every(
    Arr.make(
      Num.greaterThan(Arr.length(completed), 0),
      Num.greaterThanOrEqualTo(Arr.length(completed), context.settings.startupTrials),
      Num.greaterThanOrEqualTo(context.step, context.settings.warmupSteps),
      Num.lessThan(previousStep, nearestLower),
      Num.greaterThanOrEqualTo(Arr.length(peers), context.settings.nMinTrials)
    ),
    (value) => value
  )

  return Match.value(eligible).pipe(
    Match.when(false, () => false),
    Match.orElse(() =>
      Match.value(Arr.some(context.currentReports, (report) => Number.isNaN(report.value))).pipe(
        Match.when(true, () => true),
        Match.orElse(() =>
          Option.all({
            best: bestReport(context.currentReports, context.direction),
            threshold: percentileValue(
              peers,
              Match.value(context.direction).pipe(
                Match.when("minimize", () => context.settings.percentile),
                Match.when("maximize", () => Num.subtract(100, context.settings.percentile)),
                Match.exhaustive
              )
            )
          }).pipe(
            Option.match({
              onNone: () => false,
              onSome: ({ best, threshold }) =>
                Match.value(context.direction).pipe(
                  Match.when("minimize", () => Num.greaterThan(best, threshold)),
                  Match.when("maximize", () => Num.lessThan(best, threshold)),
                  Match.exhaustive
                )
            })
          )
        )
      )
    )
  )
}
