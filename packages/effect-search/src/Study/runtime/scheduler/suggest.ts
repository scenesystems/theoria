/**
 * Trial suggestion pipeline: sample from search space, register, and emit events.
 *
 * @since 0.1.0
 */
import { Data, Effect, Match, Number as Num, Option, Ref } from "effect"

import type { SearchError } from "../../../Errors/index.js"
import * as Rng from "../../../internal/rng.js"
import * as Sampler from "../../../Sampler/index.js"
import type * as Scheduler from "../../../Scheduler/index.js"
import type * as SearchSpace from "../../../SearchSpace/index.js"
import type { OptimizePlan, OptimizeSettings } from "../../options.js"
import type { StudyRuntime } from "../runtimeState.js"
import { suggestConfig, suggestConfigWithSampler } from "../trialReservation.js"

type ConfigFor<Space extends SearchSpace.SearchSpace> = SearchSpace.Type<Space>

/**
 * Observation record tracking a trial's config, value, and resource level for scheduler decision-making.
 *
 * @since 0.1.0
 * @category models
 */
export class SchedulerObservation<Config> extends Data.Class<{
  readonly trialNumber: number
  readonly config: Config
  readonly value: number
  readonly resource: number
}> {}

const bohbShouldExplore = (
  scheduler: Scheduler.Scheduler,
  trialNumber: number,
  completedObservations: number,
  dimensionCount: number
): Effect.Effect<boolean> =>
  Match.value(scheduler.mode).pipe(
    Match.when("hyperband", () => Effect.succeed(false)),
    Match.orElse(() => {
      const minimumObservations = Num.increment(Num.max(dimensionCount, 0))

      return Match.value(Num.lessThan(completedObservations, minimumObservations)).pipe(
        Match.when(true, () => Effect.succeed(true)),
        Match.orElse(() => {
          const explorationFraction = Option.fromNullable(scheduler.randomFraction).pipe(
            Option.getOrElse(() => 0.33)
          )
          const rollSeed = Option.fromNullable(scheduler.seed).pipe(
            Option.getOrElse(() => 0)
          )

          return Rng.nextFloat(Rng.make(`bohb:${rollSeed}:${trialNumber}`)).pipe(
            Effect.map((roll) => roll <= explorationFraction)
          )
        })
      )
    })
  )

/**
 * Suggests a configuration using either random exploration or the plan's sampler based on BOHB probability.
 *
 * @since 0.1.0
 * @category utils
 */
export const suggestByMode = <Space extends SearchSpace.SearchSpace>(
  options: OptimizePlan<ConfigFor<Space>, Space>,
  settings: OptimizeSettings,
  scheduler: Scheduler.Scheduler,
  runtime: StudyRuntime<ConfigFor<Space>>,
  trialNumberRef: Ref.Ref<number>,
  observationRef: Ref.Ref<Array<SchedulerObservation<ConfigFor<Space>>>>
): Effect.Effect<ConfigFor<Space>, SearchError> =>
  Effect.gen(function*() {
    const trialNumber = yield* Ref.get(trialNumberRef)
    const completedObservations = (yield* Ref.get(observationRef)).length
    const explore = yield* bohbShouldExplore(
      scheduler,
      trialNumber,
      completedObservations,
      options.space.params.length
    )

    return yield* Match.value(explore).pipe(
      Match.when(true, () =>
        suggestConfigWithSampler(
          options,
          settings,
          runtime,
          Sampler.random({
            ...Option.fromNullable(scheduler.seed).pipe(
              Option.match({
                onNone: () => ({}),
                onSome: (seed) => ({ seed })
              })
            )
          })
        )),
      Match.orElse(() => suggestConfig(options, settings, runtime))
    )
  })
