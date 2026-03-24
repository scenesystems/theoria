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

/**
 * Constructs a TPE `Sampler` from runtime options, wiring checkpoint
 * persistence, option validation, and the startup-aware suggest pipeline
 * into a single Sampler instance.
 *
 * This is the primary entry point for creating a Tree-structured Parzen
 * Estimator sampler for Bayesian optimization.
 *
 * @see {@link Sampler.Sampler} for the output data class
 * @see {@link suggestWithStartup} for the startup-phase routing logic
 * @since 0.1.0
 * @category constructors
 */
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
