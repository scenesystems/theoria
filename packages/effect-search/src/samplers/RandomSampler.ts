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

/**
 * Constructs a random sampler that draws uniform-random configurations from
 * the search space using a deterministic per-trial RNG derived from the seed.
 *
 * Random sampling serves as both a standalone baseline and the startup phase
 * for model-driven samplers like TPE.
 *
 * @see {@link Sampler.Sampler} for the output data class
 * @see {@link suggest} for the per-trial sampling implementation
 * @since 0.1.0
 * @category constructors
 */
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
