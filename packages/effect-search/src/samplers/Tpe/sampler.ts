/**
 * TPE sampler construction — wires options, checkpoint, and suggest into a Sampler instance.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"

import { noPendingImputationPolicy, type PendingImputationPolicy } from "../../Sampler/index.js"
import * as Sampler from "../../Sampler/index.js"
import * as RandomSampler from "../RandomSampler.js"
import { restoreCheckpoint } from "./checkpoint.js"
import {
  acquisitionFromOptions,
  candidatesFromOptions,
  constraintEvaluatorsFromOptions,
  groupDimensionsFromOptions,
  multivariateFromOptions,
  noiseOptionsFromOptions,
  seedFromOptions,
  snapshotSafeOptionsFromRuntime,
  startupTrialsFromOptions,
  type TpeRuntimeOptions,
  validateOptions
} from "./options.js"
import { suggestWithStartup } from "./startup.js"

/** @since 0.1.0 */
export const make = (
  options: TpeRuntimeOptions = {},
  pendingImputationPolicy: PendingImputationPolicy
): Sampler.Sampler => {
  const snapshotOptions = snapshotSafeOptionsFromRuntime(options)
  const startupTrials = startupTrialsFromOptions(snapshotOptions)
  const nCandidates = candidatesFromOptions(snapshotOptions)
  const seed = seedFromOptions(snapshotOptions)
  const multivariate = multivariateFromOptions(snapshotOptions)
  const groupDimensions = groupDimensionsFromOptions(snapshotOptions)
  const noiseOptions = noiseOptionsFromOptions(snapshotOptions)
  const constraints = constraintEvaluatorsFromOptions(options)
  const acquisition = acquisitionFromOptions(options)
  const randomSampler = RandomSampler.make({ seed: options.seed }, noPendingImputationPolicy)

  return new Sampler.Sampler({
    kind: Sampler.Tpe({ options: snapshotOptions }),
    pendingImputationPolicy,
    checkpoint: Effect.succeed({
      _tag: "Tpe",
      seed,
      nStartupTrials: startupTrials,
      nEiCandidates: nCandidates
    }),
    restore: (checkpoint) => restoreCheckpoint(seed, startupTrials, nCandidates, checkpoint),
    suggest: (space, context) =>
      validateOptions(snapshotOptions).pipe(
        Effect.flatMap(() =>
          suggestWithStartup(
            randomSampler,
            seed,
            startupTrials,
            nCandidates,
            multivariate,
            groupDimensions,
            noiseOptions,
            constraints,
            acquisition,
            space,
            context
          )
        )
      )
  })
}
