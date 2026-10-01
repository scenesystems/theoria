/**
 * CMA-ES checkpoint validation for resume.
 *
 * @since 0.1.0
 */
import { Boolean as Bool, Effect, Equal, Match } from "effect"

import type * as Sampler from "../../../Sampler.js"
import { InvalidOptimizationConfig } from "../../../SearchError.js"

/**
 * Validates that persisted CMA-ES checkpoint state matches runtime options
 * before allowing resume.
 *
 * @since 0.1.0
 * @category operations
 */
export const restoreCheckpoint = (
  seed: number,
  sigma: number,
  populationSize: number,
  checkpoint: Sampler.Checkpoint
): Effect.Effect<void, InvalidOptimizationConfig> =>
  Match.value(checkpoint).pipe(
    Match.tag("CmaEs", ({ seed: checkpointSeed, sigma: checkpointSigma, populationSize: checkpointPopulation }) =>
      Match.value(Bool.and(
        Equal.equals(seed, checkpointSeed),
        Bool.and(Equal.equals(sigma, checkpointSigma), Equal.equals(populationSize, checkpointPopulation))
      )).pipe(
        Match.when(true, () =>
          Effect.void),
        Match.orElse(() =>
          Effect.fail(
            new InvalidOptimizationConfig({
              reason:
                `Optimization.resume cma-es sampler checkpoint mismatch: expected { seed: ${seed}, sigma: ${sigma}, populationSize: ${populationSize} }, received { seed: ${checkpointSeed}, sigma: ${checkpointSigma}, populationSize: ${checkpointPopulation} }`
            })
          )
        )
      )),
    Match.orElse((resolved) =>
      Effect.fail(
        new InvalidOptimizationConfig({
          reason:
            `Optimization.resume cma-es sampler checkpoint tag mismatch: expected CmaEs, received ${resolved._tag}`
        })
      )
    )
  )
