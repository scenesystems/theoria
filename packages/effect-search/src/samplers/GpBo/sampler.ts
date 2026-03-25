/**
 * GP-BO sampler constructor.
 *
 * @since 0.1.0
 */
import { Effect, Option } from "effect"

import type { PendingImputationPolicy } from "../../Sampler/index.js"
import * as Sampler from "../../Sampler/index.js"
import { restoreCheckpoint } from "./checkpoint.js"
import {
  candidatesFromOptions,
  type GpBoRuntimeOptions,
  lengthScaleFromOptions,
  noiseFromOptions,
  seedFromOptions,
  snapshotSafeOptions,
  startupTrialsFromOptions,
  validateOptions
} from "./options.js"
import { suggest } from "./suggest.js"

export const make = (
  options: GpBoRuntimeOptions = {},
  pendingImputationPolicy: PendingImputationPolicy
): Sampler.Sampler => {
  const snapshotOptions = snapshotSafeOptions(options)
  const seed = seedFromOptions(snapshotOptions)
  const nStartupTrials = startupTrialsFromOptions(snapshotOptions)
  const nCandidates = candidatesFromOptions(snapshotOptions)
  const lengthScale = lengthScaleFromOptions(snapshotOptions)
  const noise = noiseFromOptions(snapshotOptions)
  const acquisition = Option.fromNullable(snapshotOptions.acquisition)

  return new Sampler.Sampler({
    kind: Sampler.GpBo({ options: snapshotOptions }),
    pendingImputationPolicy,
    checkpoint: Effect.succeed({
      _tag: "GpBo",
      seed,
      nStartupTrials,
      nCandidates,
      ...Option.match(acquisition, {
        onNone: () => ({}),
        onSome: (value) => ({ acquisition: value })
      })
    }),
    restore: (checkpoint) => restoreCheckpoint(seed, nStartupTrials, nCandidates, acquisition, checkpoint),
    suggest: (space, context) =>
      validateOptions(snapshotOptions).pipe(
        Effect.flatMap(() =>
          suggest(seed, nStartupTrials, nCandidates, lengthScale, noise, acquisition, space, context)
        )
      )
  })
}
