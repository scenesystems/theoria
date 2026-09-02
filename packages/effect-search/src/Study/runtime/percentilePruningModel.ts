/**
 * Structural input schemas for percentile pruning calculations.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { DirectionSchema } from "../../contracts/Direction.js"

/**
 * Decodes a step/value observation used for percentile comparisons; scheduling
 * code separately requires non-negative monotonic steps and finite values.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PercentilePrunerReportSchema = Schema.Struct({
  step: Schema.Number,
  value: Schema.Number
})

/**
 * An intermediate objective value recorded at a trial step.
 *
 * @since 0.1.0
 * @category type-level
 */
export type PercentilePrunerReport = Schema.Schema.Type<typeof PercentilePrunerReportSchema>

/**
 * Decodes percentile threshold, completed-trial startup count, step warmup and
 * interval, and minimum peer count. The schema does not enforce numeric ranges.
 * Percentiles are clamped to 0 through 100, non-positive intervals behave as
 * one, and fractional positive intervals are floored by the calculation.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PercentilePrunerSettingsSchema = Schema.Struct({
  percentile: Schema.Number,
  startupTrials: Schema.Number,
  warmupSteps: Schema.Number,
  intervalSteps: Schema.Number,
  nMinTrials: Schema.Number
})

/**
 * Defines the peer percentile and schedule gates used by one pruning decision.
 *
 * @since 0.1.0
 * @category type-level
 */
export type PercentilePrunerSettings = Schema.Schema.Type<typeof PercentilePrunerSettingsSchema>

/**
 * Accepts only `complete`, `pruned`, or `running`; only `complete` contributes
 * to the startup-trial count, while available reports from history may supply
 * peer values at the current step.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PercentilePrunerTrialStateSchema = Schema.Literal("complete", "pruned", "running")

/**
 * Classifies historical reports for startup counting and peer selection.
 *
 * @since 0.1.0
 * @category type-level
 */
export type PercentilePrunerTrialState = Schema.Schema.Type<typeof PercentilePrunerTrialStateSchema>

/**
 * Decodes a numbered historical trial with its lifecycle classification and
 * intermediate reports, the record used to find peer values at a matching step.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PercentilePrunerHistoryTrialSchema = Schema.Struct({
  trialNumber: Schema.Number,
  state: PercentilePrunerTrialStateSchema,
  reports: Schema.Array(PercentilePrunerReportSchema)
})

/**
 * Associates a trial's reports with its lifecycle class. Only completed trials
 * contribute peer values.
 *
 * @since 0.1.0
 * @category type-level
 */
export type PercentilePrunerHistoryTrial = Schema.Schema.Type<typeof PercentilePrunerHistoryTrialSchema>

/**
 * Decodes all inputs to one percentile decision: optimization direction,
 * schedule settings, current trial/step and reports, plus historical peers.
 * Insufficient startup, warmup, interval, or peer data produces no pruning.
 *
 * @since 0.1.0
 * @category schemas
 */
export const PercentilePrunerContextSchema = Schema.Struct({
  direction: DirectionSchema,
  settings: PercentilePrunerSettingsSchema,
  trialNumber: Schema.Number,
  step: Schema.Number,
  history: Schema.Array(PercentilePrunerHistoryTrialSchema),
  currentReports: Schema.Array(PercentilePrunerReportSchema)
})

/**
 * Contains one trial's report history, comparison direction, peer history, and
 * schedule settings for a synchronous decision.
 *
 * @since 0.1.0
 * @category type-level
 */
export type PercentilePrunerContext = Schema.Schema.Type<typeof PercentilePrunerContextSchema>
