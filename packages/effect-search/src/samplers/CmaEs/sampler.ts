/**
 * CMA-ES sampler constructor.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"

import type { PendingImputationPolicy } from "../../Sampler/index.js"
import * as Sampler from "../../Sampler/index.js"
import { restoreCheckpoint } from "./checkpoint.js"
import {
  type CmaEsRuntimeOptions,
  populationSizeFromOptions,
  seedFromOptions,
  sigmaFromOptions,
  snapshotSafeOptions,
  validateOptions
} from "./options.js"
import { suggest } from "./suggest.js"

export const make = (
  options: CmaEsRuntimeOptions = {},
  pendingImputationPolicy: PendingImputationPolicy
): Sampler.Sampler => {
  const snapshotOptions = snapshotSafeOptions(options)
  const seed = seedFromOptions(snapshotOptions)
  const sigma = sigmaFromOptions(snapshotOptions)
  const populationSize = populationSizeFromOptions(snapshotOptions)

  return new Sampler.Sampler({
    kind: Sampler.CmaEs({ options: snapshotOptions }),
    pendingImputationPolicy,
    checkpoint: Effect.succeed({
      _tag: "CmaEs",
      seed,
      sigma,
      populationSize
    }),
    restore: (checkpoint) => restoreCheckpoint(seed, sigma, populationSize, checkpoint),
    suggest: (space, context) =>
      validateOptions(snapshotOptions).pipe(
        Effect.flatMap(() => suggest(seed, sigma, populationSize, space, context))
      )
  })
}
