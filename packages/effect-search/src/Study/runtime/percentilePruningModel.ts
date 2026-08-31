/**
 * Schema definitions and types for percentile pruner configuration, reports, and history.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { DirectionSchema } from "../../contracts/Direction.js"

/**
 * Runtime schema for decoding and validating percentile pruner report.
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
 * Runtime schema for decoding and validating percentile pruner settings.
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
 * Runtime schema for decoding and validating percentile pruner trial state.
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
 * Runtime schema for decoding and validating percentile pruner history trial.
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
 * Runtime schema for decoding and validating percentile pruner context.
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
