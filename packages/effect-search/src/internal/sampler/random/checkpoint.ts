/**
 * Random sampler checkpoint — validates seed consistency on study resume.
 *
 * @since 0.1.0
 */
import { Effect, Equal, Match } from "effect"

import type * as Sampler from "../../../Sampler.js"
import { InvalidOptimizationConfig } from "../../../SearchError.js"
import type * as Rng from "../../rng.js"

/**
 * Validates that a persisted random-sampler checkpoint matches the current
 * seed, failing with `InvalidOptimizationConfig` on mismatch to prevent silent
 * replay divergence.
 *
 * Checkpoint validation catches accidental seed changes between study runs
 * that would silently produce a different suggestion sequence.
 *
 * @see {@link make} for the sampler that produces these checkpoints
 * @since 0.1.0
 * @category guards
 */
export const restoreCheckpoint = (
  seed: number,
  stream: Rng.NumPyStream,
  checkpoint: Sampler.Checkpoint
): Effect.Effect<void, InvalidOptimizationConfig> =>
  Match.value(checkpoint).pipe(
    Match.tag("Random", ({ seed: checkpointSeed, rng }) =>
      Match.value(Equal.equals(seed, checkpointSeed)).pipe(
        Match.when(true, () => stream.restore(rng)),
        Match.orElse(() =>
          Effect.fail(
            new InvalidOptimizationConfig({
              reason:
                `Optimization.resume random sampler checkpoint mismatch: expected seed ${seed}, received ${checkpointSeed}`
            })
          )
        )
      )),
    Match.orElse((resolved) =>
      Effect.fail(
        new InvalidOptimizationConfig({
          reason:
            `Optimization.resume random sampler checkpoint tag mismatch: expected Random, received ${resolved._tag}`
        })
      )
    )
  )
