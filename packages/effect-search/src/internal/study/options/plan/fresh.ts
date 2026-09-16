/** Constructs normalized internal plans from fresh public options. */
import { Effect, Option, Predicate } from "effect"

import * as Scheduler from "../../../../Scheduler.js"
import { InvalidStudyConfig } from "../../../../SearchError.js"
import type * as SearchSpace from "../../../../SearchSpace.js"
import type * as Study from "../../../../Study.js"
import { OptimizePlan } from "../plan.js"
import { commonPlanFields } from "./fields.js"

const isScheduled = <Config, Space extends SearchSpace.SearchSpace>(
  options: Study.Options<Config, Space>
): options is Study.ScheduledOptions<Config, Space> => Predicate.hasProperty(options, "scheduler")

const isFlat = <Config, Space extends SearchSpace.SearchSpace>(
  options: Study.Options<Config, Space>
): options is Study.FlatOptions<Config, Space> => Predicate.hasProperty(options, "sampler")

const invalidOptions = () => new InvalidStudyConfig({ reason: "Study.optimize requires a sampler or scheduler" })

export const optimizePlanFromOptions = <Space extends SearchSpace.SearchSpace>(
  options: Study.Options<SearchSpace.Type<Space>, Space>
): Effect.Effect<OptimizePlan<SearchSpace.Type<Space>, Space>, InvalidStudyConfig> =>
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
