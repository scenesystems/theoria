/**
 * Optimization scheduler initialization and trial scheduling strategy resolution.
 *
 * @since 0.1.0
 */
import { Effect, Option } from "effect"

import type { Policy } from "../../../Pruning.js"
import * as Scheduler from "../../../Scheduler.js"
import type { SearchError } from "../../../SearchError.js"
import { InvalidOptimizationConfig } from "../../../SearchError.js"
import type * as SearchSpace from "../../../SearchSpace.js"
import type { OptimizePlan, OptimizeSettings } from "../options/plan.js"
import { singleDirectionFromSettings } from "../options/settings.js"
import { type OptimizationRuntime } from "./bootstrap.js"
import { runBrackets } from "./scheduler/rounds.js"

type ConfigFor<Space extends SearchSpace.SearchSpace> = SearchSpace.Type<Space>

const noScheduler = (): InvalidOptimizationConfig =>
  new InvalidOptimizationConfig({
    reason: "Optimization.run received scheduler execution without a scheduler definition"
  })

const noDirection = (): InvalidOptimizationConfig =>
  new InvalidOptimizationConfig({
    reason: "Scheduler execution requires a single-objective direction"
  })

/**
 * Runs a scheduler-based optimization (Hyperband/BOHB) through all brackets and rounds, returning a summary.
 *
 * @since 0.1.0
 * @category utils
 */
export const runSchedulerOptimization = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  runtime: OptimizationRuntime<ConfigFor<Space>>,
  pruningPolicy: Policy,
  startTrialNumber: number
): Effect.Effect<Scheduler.Summary, SearchError> =>
  Effect.gen(function*() {
    const scheduler = yield* Option.fromNullable(options.scheduler).pipe(
      Option.match({
        onNone: () => Effect.fail(noScheduler()),
        onSome: Effect.succeed
      })
    )
    const direction = yield* singleDirectionFromSettings(settings).pipe(
      Option.match({
        onNone: () => Effect.fail(noDirection()),
        onSome: Effect.succeed
      })
    )
    const bracketSummaries = yield* runBrackets(
      options,
      settings,
      direction,
      runtime,
      pruningPolicy,
      scheduler,
      startTrialNumber
    )

    return new Scheduler.Summary({
      mode: scheduler.mode,
      brackets: bracketSummaries
    })
  })
