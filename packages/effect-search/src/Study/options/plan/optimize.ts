/**
 * Structural plan construction for fresh studies.
 *
 * @since 0.1.0
 */
import { Effect, Predicate, Schema } from "effect"

import { InvalidStudyConfig } from "../../../Errors/index.js"
import * as Scheduler from "../../../Scheduler/index.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import { OptimizePlan } from "../model.js"
import { OptimizePlanInputSchema } from "../schema.js"
import type { OptimizeOptions, OptimizeOptionsFromSpace, ScheduledOptimizeOptions } from "../types.js"
import { commonPlanFields } from "./common.js"

const optimizeDecodeFailure = (): InvalidStudyConfig =>
  new InvalidStudyConfig({
    reason: "Study.optimize options failed schema decode"
  })

const decodeOptimizePlanShape = <Config, Space extends SearchSpace.SearchSpace>(
  options: OptimizeOptions<Config, Space>
): Effect.Effect<void, InvalidStudyConfig> =>
  Schema.decodeUnknown(OptimizePlanInputSchema)(options).pipe(
    Effect.mapError(() => optimizeDecodeFailure()),
    Effect.asVoid
  )

const isScheduledOptimizeOptions = <Config, Space extends SearchSpace.SearchSpace>(
  options: OptimizeOptions<Config, Space>
): options is ScheduledOptimizeOptions<Config, Space> => Predicate.hasProperty(options, "scheduler")

/**
 * Checks the flat or scheduled input shape and copies it into an
 * {@link OptimizePlan}. Scheduled input derives its sampler and total trial count
 * from the scheduler. Defaults and numeric constraints are resolved and checked
 * later by `normalizeSettings` and {@link validateSettings}.
 *
 * @typeParam Space - Compiled search space supplying the plan's configuration type.
 *
 * @since 0.1.0
 * @category constructors
 */
export const optimizePlanFromOptions = <Space extends SearchSpace.SearchSpace>(
  options: OptimizeOptionsFromSpace<Space>
): Effect.Effect<OptimizePlan<SearchSpace.Type<Space>, Space>, InvalidStudyConfig> =>
  decodeOptimizePlanShape(options).pipe(
    Effect.map(() => {
      if (isScheduledOptimizeOptions(options)) {
        return new OptimizePlan({
          space: options.space,
          sampler: options.scheduler.sampler,
          scheduler: options.scheduler,
          objective: options.objective,
          trials: Scheduler.totalTrials(options.scheduler),
          ...commonPlanFields(options)
        })
      }

      return new OptimizePlan({
        space: options.space,
        sampler: options.sampler,
        objective: options.objective,
        trials: options.trials,
        ...commonPlanFields(options)
      })
    })
  )
