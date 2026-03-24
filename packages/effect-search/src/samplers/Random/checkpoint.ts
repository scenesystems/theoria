/**
 * Random sampler checkpoint — validates seed consistency on study resume.
 *
 * @since 0.1.0
 */
import { Effect, Match } from "effect"

import { InvalidStudyConfig } from "../../Errors/index.js"
import type * as Sampler from "../../Sampler/index.js"

/** @since 0.1.0 */
export const restoreCheckpoint = (
  seed: number,
  checkpoint: Sampler.SamplerCheckpoint
): Effect.Effect<void, InvalidStudyConfig> =>
  Match.value(checkpoint).pipe(
    Match.tag("Random", ({ seed: checkpointSeed }) =>
      Match.value(seed === checkpointSeed).pipe(
        Match.when(true, () => Effect.void),
        Match.orElse(() =>
          Effect.fail(
            new InvalidStudyConfig({
              reason:
                `Study.resume random sampler checkpoint mismatch: expected seed ${seed}, received ${checkpointSeed}`
            })
          )
        )
      )),
    Match.orElse((resolved) =>
      Effect.fail(
        new InvalidStudyConfig({
          reason: `Study.resume random sampler checkpoint tag mismatch: expected Random, received ${resolved._tag}`
        })
      )
    )
  )
