import { Effect, Match, Option } from "effect"

import { InvalidStudyConfig } from "../Errors/index.js"
import { enumerateGrid } from "../internal/grid.js"
import type { PendingImputationPolicy, SuggestContext } from "../Sampler/index.js"
import * as Sampler from "../Sampler/index.js"
import { booleanOptionOr, numberOptionOr } from "../Sampler/shared/optionReaders.js"
import type * as SearchSpace from "../SearchSpace/index.js"
import { configAtCursor } from "./Grid/cursor.js"
import { finiteDimensionsFromSpace } from "./Grid/finiteDimensions.js"
import { orderGridConfigs } from "./Grid/ordering.js"

const restoreCheckpoint = (
  seed: number,
  shuffle: boolean,
  checkpoint: Sampler.SamplerCheckpoint
): Effect.Effect<void, InvalidStudyConfig> =>
  Match.value(checkpoint).pipe(
    Match.tag("Grid", ({ seed: checkpointSeed, shuffle: checkpointShuffle }) =>
      Match.value(seed === checkpointSeed && shuffle === checkpointShuffle).pipe(
        Match.when(true, () =>
          Effect.void),
        Match.orElse(() =>
          Effect.fail(
            new InvalidStudyConfig({
              reason:
                `Study.resume grid sampler checkpoint mismatch: expected { seed: ${seed}, shuffle: ${shuffle} }, ` +
                `received { seed: ${checkpointSeed}, shuffle: ${checkpointShuffle} }`
            })
          )
        )
      )),
    Match.orElse((resolved) =>
      Effect.fail(
        new InvalidStudyConfig({
          reason: `Study.resume grid sampler checkpoint tag mismatch: expected Grid, received ${resolved._tag}`
        })
      )
    )
  )

export const make = (
  options: Sampler.GridOptions = {},
  pendingImputationPolicy: PendingImputationPolicy
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
    suggest: (space: SearchSpace.SearchSpace, context: SuggestContext) =>
      Effect.gen(function*() {
        const dimensions = yield* finiteDimensionsFromSpace(space)

        const grid = enumerateGrid(dimensions)
        const orderedGrid = yield* orderGridConfigs(grid, shuffle, seed)

        return yield* configAtCursor(orderedGrid, context.nextTrialNumber)
      })
  })
}
