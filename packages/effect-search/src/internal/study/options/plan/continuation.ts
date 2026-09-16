/**
 * Structural plan conversion for snapshot continuation.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"

import type { InvalidStudyConfig } from "../../../../SearchError.js"
import type * as SearchSpace from "../../../../SearchSpace.js"
import type * as Study from "../../../../Study.js"
import type * as StudySnapshot from "../../../../StudySnapshot.js"
import { OptimizePlan, ResumePlan } from "../plan.js"
import { commonPlanFields } from "./fields.js"

/**
 * Checks the resume input shape and copies it into a {@link ResumePlan}. This
 * does not compare snapshot metadata with the requested study or restore the
 * sampler checkpoint.
 *
 * @typeParam Space - Compiled search space supplying the continuation plan's configuration type.
 *
 * @since 0.1.0
 * @category constructors
 */
export const resumePlanFromOptions = <Space extends SearchSpace.SearchSpace>(
  options: Study.ResumeOptions<SearchSpace.Type<Space>, Space>
): Effect.Effect<ResumePlan<SearchSpace.Type<Space>, Space>, InvalidStudyConfig> =>
  Effect.succeed(
    new ResumePlan({
      space: options.space,
      sampler: options.sampler,
      snapshot: options.snapshot,
      objective: options.objective,
      trials: options.trials,
      ...commonPlanFields(options)
    })
  )

/**
 * Removes the snapshot from a resume plan while preserving all additional-work
 * settings for execution.
 *
 * @typeParam Space - Compiled search space retained by the converted plan.
 *
 * @since 0.1.0
 * @category constructors
 */
export const optimizePlanFromResume = <Space extends SearchSpace.SearchSpace>(
  options: ResumePlan<SearchSpace.Type<Space>, Space>
): OptimizePlan<SearchSpace.Type<Space>, Space> =>
  new OptimizePlan({
    space: options.space,
    sampler: options.sampler,
    objective: options.objective,
    trials: options.trials,
    ...commonPlanFields(options)
  })

/**
 * Attaches a loaded snapshot without mutating the storage-based options object.
 *
 * @typeParam Space - Compiled search space retained by the returned resume options.
 *
 * @since 0.1.0
 * @category constructors
 */
export const resumeOptionsWithSnapshot = <Space extends SearchSpace.SearchSpace>(
  options: Study.StorageResumeOptions<SearchSpace.Type<Space>, Space>,
  snapshot: StudySnapshot.StudySnapshot
): Study.ResumeOptions<SearchSpace.Type<Space>, Space> => ({
  ...options,
  snapshot
})

/**
 * Removes the snapshot and copies continuation fields into flat optimization
 * options. `trials` retains its meaning as additional work.
 *
 * @typeParam Space - Compiled search space retained by the returned optimization options.
 *
 * @since 0.1.0
 * @category constructors
 */
export const optimizeOptionsFromResume = <Space extends SearchSpace.SearchSpace>(
  options: Study.ResumeOptions<SearchSpace.Type<Space>, Space>
): Study.Options<SearchSpace.Type<Space>, Space> => ({
  space: options.space,
  sampler: options.sampler,
  objective: options.objective,
  trials: options.trials,
  ...commonPlanFields(options)
})
