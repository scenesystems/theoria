/**
 * Grid sampler — exhaustive enumeration of finite search spaces.
 *
 * @since 0.1.0
 */
import { Boolean as Bool, Effect, Equal, Match, Option } from "effect"

import type { Context, PendingPolicy } from "../../Sampler.js"
import * as Sampler from "../../Sampler.js"
import { InvalidOptimizationConfig } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
import { enumerateGrid } from "../grid.js"
import { configAtCursor } from "./grid/cursor.js"
import { finiteDimensionsFromSpace } from "./grid/finiteDimensions.js"
import { orderGridConfigs } from "./grid/ordering.js"
import { booleanOptionOr, numberOptionOr } from "./optionReaders.js"

const restoreCheckpoint = (
  seed: number,
  shuffle: boolean,
  checkpoint: Sampler.Checkpoint
): Effect.Effect<void, InvalidOptimizationConfig> =>
  Match.value(checkpoint).pipe(
    Match.tag("Grid", ({ seed: checkpointSeed, shuffle: checkpointShuffle }) =>
      Match.value(Bool.and(Equal.equals(seed, checkpointSeed), Equal.equals(shuffle, checkpointShuffle))).pipe(
        Match.when(true, () =>
          Effect.void),
        Match.orElse(() =>
          Effect.fail(
            new InvalidOptimizationConfig({
              reason:
                `Optimization.resume grid sampler checkpoint mismatch: expected { seed: ${seed}, shuffle: ${shuffle} }, received { seed: ${checkpointSeed}, shuffle: ${checkpointShuffle} }`
            })
          )
        )
      )),
    Match.orElse((resolved) =>
      Effect.fail(
        new InvalidOptimizationConfig({
          reason: `Optimization.resume grid sampler checkpoint tag mismatch: expected Grid, received ${resolved._tag}`
        })
      )
    )
  )

/**
 * Constructs a grid sampler that enumerates the Cartesian product of finite
 * dimensions, optionally shuffled, and yields one configuration per trial index.
 *
 * Grid search is exhaustive — it covers every combination exactly once,
 * making it suitable for small discrete search spaces.
 *
 * @see {@link Sampler.Sampler} for the output data class
 * @see {@link finiteDimensionValues} for how parameter grids are extracted
 * @since 0.1.0
 * @category constructors
 */
export const make = (
  options: Sampler.GridOptions = {},
  pendingImputationPolicy: PendingPolicy
): Sampler.Sampler => {
  const seed = numberOptionOr(Option.fromNullable(options.seed), 0)
  const shuffle = booleanOptionOr(Option.fromNullable(options.shuffle), false)

  return new Sampler.Sampler({
    kind: Sampler.Grid({ options }),
    pendingImputationPolicy,
    checkpoint: Effect.succeed({
      _tag: "Grid",
      seed,
      shuffle
    }),
    restore: (checkpoint) => restoreCheckpoint(seed, shuffle, checkpoint),
    suggest: (space: SearchSpace.SearchSpace, context: Context) =>
      Effect.gen(function*() {
        const dimensions = yield* finiteDimensionsFromSpace(space)

        const grid = enumerateGrid(dimensions)
        const orderedGrid = yield* orderGridConfigs(grid, shuffle, seed)

        return yield* configAtCursor(orderedGrid, context.nextTrialNumber)
      })
  })
}
