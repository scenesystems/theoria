/**
 * Grid ordering — optional Fisher–Yates shuffle of enumerated grid configurations.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Match, Number as Num, Option, Schema } from "effect"

import { type GridConfig, GridConfigSchema } from "../../grid.js"
import * as Rng from "../../rng.js"

const GridConfigs = Schema.Array(GridConfigSchema)
type GridConfigs = typeof GridConfigs.Type

const shuffleAtIndex = (
  outputInput: Iterable<GridConfig>,
  index: number,
  rng: Rng.Rng
): Effect.Effect<GridConfigs> => {
  const output = Arr.fromIterable(outputInput)
  return Match.value(Num.lessThanOrEqualTo(index, 0)).pipe(
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

        const swapped = Arr.modify(Arr.modify(output, index, () => targetValue), target, () => current)

        return yield* shuffleAtIndex(swapped, Num.decrement(index), rng)
      })),
    Match.exhaustive
  )
}

const shuffledGridConfigs = (
  configsInput: Iterable<GridConfig>,
  seed: number
): Effect.Effect<GridConfigs> => {
  const configs = Arr.fromIterable(configsInput)
  return Effect.gen(function*() {
    const rng = Rng.make(seed)
    const output = Arr.fromIterable(configs)

    return yield* shuffleAtIndex(output, Num.decrement(Arr.length(output)), rng)
  })
}

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
  configsInput: Iterable<GridConfig>,
  shuffle: boolean,
  seed: number
): Effect.Effect<GridConfigs> => {
  const configs = Arr.fromIterable(configsInput)
  return Match.value(shuffle).pipe(
    Match.when(true, () => shuffledGridConfigs(configs, seed)),
    Match.when(false, () => Effect.succeed(configs)),
    Match.exhaustive
  )
}
