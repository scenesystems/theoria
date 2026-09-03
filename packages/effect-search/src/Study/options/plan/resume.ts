/**
 * Structural plan conversion for snapshot continuation.
 *
 * @since 0.1.0
 */
import { Effect, Schema } from "effect"

import { InvalidStudyConfig } from "../../../Errors/index.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import type { StudySnapshot } from "../../snapshot/versioning.js"
import { OptimizePlan, ResumePlan } from "../model.js"
import { ResumePlanInputSchema } from "../schema.js"
import type {
  OptimizeOptionsFromSpace,
  ResumeFromStorageOptionsFromSpace,
  ResumeOptions,
  ResumeOptionsFromSpace
} from "../types.js"
import { commonPlanFields } from "./common.js"

const resumeDecodeFailure = (): InvalidStudyConfig =>
  new InvalidStudyConfig({
    reason: "Study.resume options failed schema decode"
  })

const decodeResumePlanShape = <Config, Space extends SearchSpace.SearchSpace>(
  options: ResumeOptions<Config, Space>
): Effect.Effect<void, InvalidStudyConfig> =>
  Schema.decodeUnknown(ResumePlanInputSchema)(options).pipe(
    Effect.mapError(() => resumeDecodeFailure()),
    Effect.asVoid
  )

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
  options: ResumeOptionsFromSpace<Space>
): Effect.Effect<ResumePlan<SearchSpace.Type<Space>, Space>, InvalidStudyConfig> =>
  decodeResumePlanShape(options).pipe(
    Effect.as(
      new ResumePlan({
        space: options.space,
        sampler: options.sampler,
        snapshot: options.snapshot,
        objective: options.objective,
        trials: options.trials,
        ...commonPlanFields(options)
      })
    )
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
  options: ResumeFromStorageOptionsFromSpace<Space>,
  snapshot: StudySnapshot
): ResumeOptionsFromSpace<Space> => ({
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
  options: ResumeOptionsFromSpace<Space>
): OptimizeOptionsFromSpace<Space> => ({
  space: options.space,
  sampler: options.sampler,
  objective: options.objective,
  trials: options.trials,
  ...commonPlanFields(options)
})
