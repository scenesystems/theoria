/**
 * Schema definitions and types for percentile pruner configuration, reports, and history.
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
 * interval, and minimum peer count. Algorithm constructors are responsible for
 * enforcing their numeric ranges before these settings drive pruning.
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
 * Threshold and warmup settings controlling percentile-based pruning.
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
 * A trial lifecycle state considered by percentile pruning.
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
 * Historical trial state and reports used by percentile pruning.
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
 * Current and historical trial data needed to compute a percentile prune decision.
 *
 * @since 0.1.0
 * @category type-level
 */
export type PercentilePrunerContext = Schema.Schema.Type<typeof PercentilePrunerContextSchema>
