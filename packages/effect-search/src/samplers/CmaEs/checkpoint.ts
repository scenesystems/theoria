/**
 * CMA-ES checkpoint validation for resume.
 *
 * @since 0.1.0
 */
import { Effect, Match } from "effect"

import { InvalidStudyConfig } from "../../Errors/index.js"
import type * as Sampler from "../../Sampler/index.js"

export const restoreCheckpoint = (
  seed: number,
  sigma: number,
  populationSize: number,
  checkpoint: Sampler.SamplerCheckpoint
): Effect.Effect<void, InvalidStudyConfig> =>
  Match.value(checkpoint).pipe(
    Match.tag("CmaEs", ({ seed: checkpointSeed, sigma: checkpointSigma, populationSize: checkpointPopulation }) =>
      Match.value(seed === checkpointSeed && sigma === checkpointSigma && populationSize === checkpointPopulation).pipe(
        Match.when(true, () =>
          Effect.void),
        Match.orElse(() =>
          Effect.fail(
            new InvalidStudyConfig({
              reason: "Study.resume cma-es sampler checkpoint mismatch: " +
                `expected { seed: ${seed}, sigma: ${sigma}, populationSize: ${populationSize} }, ` +
                `received { seed: ${checkpointSeed}, sigma: ${checkpointSigma}, populationSize: ${checkpointPopulation} }`
            })
          )
        )
      )),
    Match.orElse((resolved) =>
      Effect.fail(
        new InvalidStudyConfig({
          reason: `Study.resume cma-es sampler checkpoint tag mismatch: expected CmaEs, received ${resolved._tag}`
        })
      )
    )
  )
