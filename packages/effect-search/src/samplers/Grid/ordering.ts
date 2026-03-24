/**
 * Grid ordering — optional Fisher–Yates shuffle of enumerated grid configurations.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Match, Number as Num, Option } from "effect"

import type { GridConfig } from "../../internal/grid.js"
import * as Rng from "../../internal/rng.js"

const shuffleAtIndex = (
  output: Array<GridConfig>,
  index: number,
  rng: Rng.Rng
): Effect.Effect<Array<GridConfig>> =>
  Match.value(Num.lessThanOrEqualTo(index, 0)).pipe(
    Match.when(true, () => Effect.succeed(output)),
    Match.when(false, () =>
      Effect.gen(function*() {
        const target = yield* Rng.nextInt(rng, 0, index)
        const current = Arr.get(output, index).pipe(
          Option.getOrElse((): GridConfig => ({}))
        )
        const targetValue = Arr.get(output, target).pipe(
          Option.getOrElse((): GridConfig => current)
        )

        output[index] = targetValue
        output[target] = current

        return yield* shuffleAtIndex(output, Num.decrement(index), rng)
      })),
    Match.exhaustive
  )

const shuffledGridConfigs = (
  configs: ReadonlyArray<GridConfig>,
  seed: number
): Effect.Effect<ReadonlyArray<GridConfig>> =>
  Effect.gen(function*() {
    const rng = Rng.make(seed)
    const output = Arr.fromIterable(configs)

    return yield* shuffleAtIndex(output, output.length - 1, rng)
  })

/**
 * Optionally applies a seeded Fisher–Yates shuffle to enumerated grid
 * configurations, returning them in traversal order or randomized order.
 *
 * When shuffled, the grid is permuted deterministically from the seed,
 * useful for interleaving diverse configs early in large grid searches.
 *
 * @see {@link finiteDimensionsFromSpace} for the grid enumeration step
 * @since 0.1.0
 * @category constructors
 */
export const orderGridConfigs = (
  configs: ReadonlyArray<GridConfig>,
  shuffle: boolean,
  seed: number
): Effect.Effect<ReadonlyArray<GridConfig>> =>
  Match.value(shuffle).pipe(
    Match.when(true, () => shuffledGridConfigs(configs, seed)),
    Match.when(false, () => Effect.succeed(configs)),
    Match.exhaustive
  )
