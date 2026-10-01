/** Constructs normalized internal optimization plans from fresh public options. */
import { Effect, Option, Predicate } from "effect"

import type * as Optimization from "../../../../Optimization.js"
import * as Scheduler from "../../../../Scheduler.js"
import { InvalidOptimizationConfig } from "../../../../SearchError.js"
import type * as SearchSpace from "../../../../SearchSpace.js"
import { OptimizePlan } from "../plan.js"
import { commonPlanFields } from "./fields.js"

const isScheduled = <Config, Space extends SearchSpace.SearchSpace>(
  options: Optimization.Options<Config, Space>
): options is Optimization.ScheduledOptions<Config, Space> => Predicate.hasProperty(options, "scheduler")

const isFlat = <Config, Space extends SearchSpace.SearchSpace>(
  options: Optimization.Options<Config, Space>
): options is Optimization.FlatOptions<Config, Space> => Predicate.hasProperty(options, "sampler")

const invalidOptions = () =>
  new InvalidOptimizationConfig({ reason: "Optimization.run requires a sampler or scheduler" })

export const optimizePlanFromOptions = <Space extends SearchSpace.SearchSpace>(
  options: Optimization.Options<SearchSpace.Type<Space>, Space>
): Effect.Effect<OptimizePlan<SearchSpace.Type<Space>, Space>, InvalidOptimizationConfig> =>
  Option.liftPredicate(options, isScheduled).pipe(
    Option.match({
      onSome: (scheduled) =>
        Effect.succeed(
          new OptimizePlan({
            space: scheduled.space,
            sampler: scheduled.scheduler.sampler,
            scheduler: scheduled.scheduler,
            objective: scheduled.objective,
            trials: Scheduler.totalTrials(scheduled.scheduler),
            ...commonPlanFields(scheduled)
          })
        ),
      onNone: () =>
        Option.liftPredicate(options, isFlat).pipe(
          Option.match({
            onNone: () => Effect.fail(invalidOptions()),
            onSome: (flat) =>
              Effect.succeed(
                new OptimizePlan({
                  space: flat.space,
                  sampler: flat.sampler,
                  objective: flat.objective,
                  trials: flat.trials,
                  ...commonPlanFields(flat)
                })
              )
          })
        )
    })
  )
