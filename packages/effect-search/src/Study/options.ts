/**
 * Re-exports all study option types, plan constructors, and settings normalization.
 *
 * @since 0.1.0
 */
export { OptimizePlanFlatInputSchema, OptimizePlanScheduledInputSchema } from "./options/schema.js"

export {
  OptimizePlan,
  OptimizeSettings,
  PriorTrial,
  ResumePlan,
  type RetrySchedule,
  retryScheduleOrDefault
} from "./options/model.js"

export type {
  FlatOptimizeOptions,
  OptimizeOptions,
  OptimizeOptionsFromSpace,
  ResumeFromStorageOptions,
  ResumeFromStorageOptionsFromSpace,
  ResumeOptions,
  ResumeOptionsFromSpace,
  ScheduledOptimizeOptions
} from "./options/types.js"

export { optimizePlanFromOptions } from "./options/plan/optimize.js"

export {
  optimizeOptionsFromResume,
  optimizePlanFromResume,
  resumeOptionsWithSnapshot,
  resumePlanFromOptions
} from "./options/plan/resume.js"

export {
  normalizeSettings,
  pruningPolicyFromOptions,
  singleDirectionFromSettings,
  validateSettings
} from "./options/settings.js"
