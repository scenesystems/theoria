/**
 * ResumePlan construction from resume and storage-resume options.
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
 * @since 0.1.0
 * @category utils
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
 * @since 0.1.0
 * @category utils
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
 * @since 0.1.0
 * @category utils
 */
export const resumeOptionsWithSnapshot = <Space extends SearchSpace.SearchSpace>(
  options: ResumeFromStorageOptionsFromSpace<Space>,
  snapshot: StudySnapshot
): ResumeOptionsFromSpace<Space> => ({
  ...options,
  snapshot
})

/**
 * @since 0.1.0
 * @category utils
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
