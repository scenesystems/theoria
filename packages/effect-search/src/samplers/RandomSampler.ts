/**
 * Random sampler — uniform random suggestion across the search space.
 *
 * @since 0.1.0
 */
import { Effect, Option } from "effect"

import type { PendingImputationPolicy } from "../Sampler/index.js"
import * as Sampler from "../Sampler/index.js"
import { numberOptionOr } from "../Sampler/shared/optionReaders.js"
import { restoreCheckpoint } from "./Random/checkpoint.js"
import { suggest } from "./Random/suggest.js"

/** @since 0.1.0 */
export const make = (
  options: Sampler.RandomOptions = {},
  pendingImputationPolicy: PendingImputationPolicy
): Sampler.Sampler => {
  const seed = numberOptionOr(Option.fromNullable(options.seed), 0)

  return new Sampler.Sampler({
    kind: Sampler.Random({ options }),
    pendingImputationPolicy,
    checkpoint: Effect.succeed({
      _tag: "Random",
      seed
    }),
    restore: (checkpoint) => restoreCheckpoint(seed, checkpoint),
    suggest: (space, context) => suggest(seed, space, context)
  })
}
