/**
 * Scheduler initialization and trial scheduling strategy resolution.
 *
 * @since 0.1.0
 */
import { Chunk, Effect, Option } from "effect"

import type { Policy } from "../../../Pruning.js"
import * as Scheduler from "../../../Scheduler.js"
import type { SearchError } from "../../../SearchError.js"
import { InvalidStudyConfig } from "../../../SearchError.js"
import type * as SearchSpace from "../../../SearchSpace.js"
import type { OptimizePlan, OptimizeSettings } from "../options/plan.js"
import { singleDirectionFromSettings } from "../options/settings.js"
import { type StudyRuntime } from "./runtimeState.js"
import { runBrackets } from "./scheduler/rounds.js"

type ConfigFor<Space extends SearchSpace.SearchSpace> = SearchSpace.Type<Space>

const noScheduler = (): InvalidStudyConfig =>
  new InvalidStudyConfig({
    reason: "Study.optimize received scheduler execution without a scheduler definition"
  })

const noDirection = (): InvalidStudyConfig =>
  new InvalidStudyConfig({
    reason: "Scheduler execution requires a single-objective direction"
  })

/**
 * Runs a scheduler-based study (Hyperband/BOHB) through all brackets and rounds, returning a summary.
 *
 * @since 0.1.0
 * @category utils
 */
export const runSchedulerStudy = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  runtime: StudyRuntime<ConfigFor<Space>>,
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
      brackets: Chunk.fromIterable(bracketSummaries)
    })
  })
