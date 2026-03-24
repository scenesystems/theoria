/**
 * TPE checkpoint — validates seed, startup, and candidate count consistency on study resume.
 *
 * @since 0.1.0
 */
import { Effect, Match } from "effect"

import { InvalidStudyConfig } from "../../Errors/index.js"
import type * as Sampler from "../../Sampler/index.js"

/** @since 0.1.0 */
export const restoreCheckpoint = (
  seed: number,
  startupTrials: number,
  nCandidates: number,
  checkpoint: Sampler.SamplerCheckpoint
): Effect.Effect<void, InvalidStudyConfig> =>
  Match.value(checkpoint).pipe(
    Match.tag("Tpe", ({ seed: checkpointSeed, nStartupTrials, nEiCandidates }) =>
      Match.value(
        seed === checkpointSeed && startupTrials === nStartupTrials && nCandidates === nEiCandidates
      ).pipe(
        Match.when(true, () => Effect.void),
        Match.orElse(() =>
          Effect.fail(
            new InvalidStudyConfig({
              reason: "Study.resume tpe sampler checkpoint mismatch: " +
                `expected { seed: ${seed}, nStartupTrials: ${startupTrials}, nEiCandidates: ${nCandidates} }, ` +
                `received { seed: ${checkpointSeed}, nStartupTrials: ${nStartupTrials}, nEiCandidates: ${nEiCandidates} }`
            })
          )
        )
      )),
    Match.orElse((resolved) =>
      Effect.fail(
        new InvalidStudyConfig({
          reason: `Study.resume tpe sampler checkpoint tag mismatch: expected Tpe, received ${resolved._tag}`
        })
      )
    )
  )
