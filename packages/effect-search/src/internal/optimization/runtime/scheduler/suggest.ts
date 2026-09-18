/**
 * Optimization trial suggestion: sample, register, and emit events.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Match, Number as Num, Option, Ref } from "effect"

import * as Rng from "../../../../internal/rng.js"
import * as Sampler from "../../../../Sampler.js"
import type * as Scheduler from "../../../../Scheduler.js"
import type { SearchError } from "../../../../SearchError.js"
import type * as SearchSpace from "../../../../SearchSpace.js"
import type { OptimizePlan, OptimizeSettings } from "../../options/plan.js"
import type { OptimizationRuntime } from "../bootstrap.js"
import { suggestConfig, suggestConfigWithSampler } from "../trialReservation.js"

type ConfigFor<Space extends SearchSpace.SearchSpace> = SearchSpace.Type<Space>

const bohbShouldExplore = (
  scheduler: Scheduler.Plan,
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
            Effect.map((roll) => Num.lessThanOrEqualTo(roll, explorationFraction))
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
  scheduler: Scheduler.Plan,
  runtime: OptimizationRuntime<ConfigFor<Space>>,
  trialNumberRef: Ref.Ref<number>,
  completedCountRef: Ref.Ref<number>
): Effect.Effect<ConfigFor<Space>, SearchError> =>
  Effect.gen(function*() {
    const trialNumber = yield* Ref.get(trialNumberRef)
    const completedObservations = yield* Ref.get(completedCountRef)
    const explore = yield* bohbShouldExplore(
      scheduler,
      trialNumber,
      completedObservations,
      Arr.length(options.space.params)
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
