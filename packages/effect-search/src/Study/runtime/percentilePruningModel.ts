/**
 * Schema definitions and types for percentile pruner configuration, reports, and history.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { DirectionSchema } from "../../contracts/Direction.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export const PercentilePrunerReportSchema = Schema.Struct({
  step: Schema.Number,
  value: Schema.Number
})

/**
 * @since 0.1.0
 * @category type-level
 */
export type PercentilePrunerReport = Schema.Schema.Type<typeof PercentilePrunerReportSchema>

/**
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
 * @since 0.1.0
 * @category type-level
 */
export type PercentilePrunerSettings = Schema.Schema.Type<typeof PercentilePrunerSettingsSchema>

/**
 * @since 0.1.0
 * @category schemas
 */
export const PercentilePrunerTrialStateSchema = Schema.Literal("complete", "pruned", "running")

/**
 * @since 0.1.0
 * @category type-level
 */
export type PercentilePrunerTrialState = Schema.Schema.Type<typeof PercentilePrunerTrialStateSchema>

/**
 * @since 0.1.0
 * @category schemas
 */
export const PercentilePrunerHistoryTrialSchema = Schema.Struct({
  trialNumber: Schema.Number,
  state: PercentilePrunerTrialStateSchema,
  reports: Schema.Array(PercentilePrunerReportSchema)
})

/**
 * @since 0.1.0
 * @category type-level
 */
export type PercentilePrunerHistoryTrial = Schema.Schema.Type<typeof PercentilePrunerHistoryTrialSchema>

/**
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
 * @since 0.1.0
 * @category type-level
 */
export type PercentilePrunerContext = Schema.Schema.Type<typeof PercentilePrunerContextSchema>
