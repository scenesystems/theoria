/**
 * GP-BO checkpoint validation for resume.
 *
 * @since 0.1.0
 */
import { Boolean as Bool, Effect, Equal, Match, Option } from "effect"

import type { Name } from "../../../Acquisition.js"
import type * as Sampler from "../../../Sampler.js"
import { InvalidStudyConfig } from "../../../SearchError.js"

const acquisitionMatches = (
  expected: Option.Option<Name>,
  actual: Option.Option<Name>
): boolean =>
  Option.match(expected, {
    onNone: () => Option.isNone(actual),
    onSome: (resolvedExpected) =>
      Option.match(actual, {
        onNone: () => false,
        onSome: (resolvedActual) => Equal.equals(resolvedActual, resolvedExpected)
      })
  })

const acquisitionLabel = (acquisition: Option.Option<Name>): string =>
  Option.match(acquisition, {
    onNone: () => "none",
    onSome: (value) => value
  })

/**
 * Validates that persisted GP-BO checkpoint state matches runtime options
 * before allowing resume.
 *
 * @since 0.1.0
 * @category operations
 */
export const restoreCheckpoint = (
  seed: number,
  nStartupTrials: number,
  nCandidates: number,
  lengthScale: number,
  noise: number,
  acquisition: Option.Option<Name>,
  checkpoint: Sampler.Checkpoint
): Effect.Effect<void, InvalidStudyConfig> =>
  Match.value(checkpoint).pipe(
    Match.tag(
      "GpBo",
      (
        {
          seed: checkpointSeed,
          nStartupTrials: checkpointStartup,
          nCandidates: checkpointCandidates,
          lengthScale: checkpointLengthScale,
          noise: checkpointNoise,
          acquisition: checkpointAcquisition
        }
      ) =>
        Effect.gen(function*() {
          const checkpointAcquisitionOption = Option.fromNullable(checkpointAcquisition)

          return yield* Match.value(
            Bool.and(
              Bool.and(
                Bool.and(Equal.equals(seed, checkpointSeed), Equal.equals(nStartupTrials, checkpointStartup)),
                Bool.and(
                  Equal.equals(nCandidates, checkpointCandidates),
                  Equal.equals(lengthScale, checkpointLengthScale)
                )
              ),
              Bool.and(
                Equal.equals(noise, checkpointNoise),
                acquisitionMatches(acquisition, checkpointAcquisitionOption)
              )
            )
          ).pipe(
            Match.when(true, () => Effect.void),
            Match.orElse(() =>
              Effect.fail(
                new InvalidStudyConfig({
                  reason:
                    `Study.resume gp-bo sampler checkpoint mismatch: expected { seed: ${seed}, nStartupTrials: ${nStartupTrials}, nCandidates: ${nCandidates}, lengthScale: ${lengthScale}, noise: ${noise}, acquisition: ${
                      acquisitionLabel(acquisition)
                    } }, received { seed: ${checkpointSeed}, nStartupTrials: ${checkpointStartup}, nCandidates: ${checkpointCandidates}, lengthScale: ${checkpointLengthScale}, noise: ${checkpointNoise}, acquisition: ${
                      acquisitionLabel(checkpointAcquisitionOption)
                    } }`
                })
              )
            )
          )
        })
    ),
    Match.orElse((resolved) =>
      Effect.fail(
        new InvalidStudyConfig({
          reason: `Study.resume gp-bo sampler checkpoint tag mismatch: expected GpBo, received ${resolved._tag}`
        })
      )
    )
  )
