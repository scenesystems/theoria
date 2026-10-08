/**
 * Random sampler — uniform random suggestion across the search space.
 *
 * @since 0.1.0
 */
import { Effect, Option } from "effect"

import type { PendingPolicy } from "../../Sampler.js"
import * as Sampler from "../../Sampler.js"
import * as Rng from "../rng.js"
import { numberOptionOr } from "./optionReaders.js"
import { restoreCheckpoint } from "./random/checkpoint.js"
import { suggest } from "./random/suggest.js"

/**
 * Constructs a random sampler that draws uniform-random configurations from
 * the search space using one persistent NumPy legacy stream initialized from the seed.
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
  pendingImputationPolicy: PendingPolicy
): Sampler.Sampler => {
  const seed = numberOptionOr(Option.fromNullishOr(options.seed), 0)
  const stream = new Rng.NumPyStream(seed)

  return new Sampler.Sampler({
    kind: Sampler.Random({ options }),
    pendingImputationPolicy,
    checkpoint: stream.snapshot.pipe(Effect.map((rng) => ({
      _tag: "Random",
      seed,
      rng
    }))),
    restore: (checkpoint) => restoreCheckpoint(seed, stream, checkpoint),
    suggest: (space) => stream.get.pipe(Effect.flatMap((rng) => suggest(rng, space)))
  })
}
