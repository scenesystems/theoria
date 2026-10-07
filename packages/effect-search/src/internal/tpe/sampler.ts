/**
 * TPE sampler construction — wires options, checkpoint, and suggest into a Sampler instance.
 *
 * @since 0.1.0
 */
import { Array as Arr, Boolean as Bool, Effect, Equal, Option } from "effect"

import { type PendingPolicy, TpeOptions } from "../../Sampler.js"
import * as Sampler from "../../Sampler.js"
import * as Rng from "../rng.js"
import { suggest as suggestRandom } from "../sampler/random/suggest.js"
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
  options: TpeOptions = new TpeOptions({}),
  pendingImputationPolicy: PendingPolicy
): Sampler.Sampler => {
  const snapshotOptions = snapshotSafeOptionsFromRuntime(options)
  const startupTrials = startupTrialsFromOptions(options)
  const nCandidates = candidatesFromOptions(options)
  const seed = seedFromOptions(options)
  const multivariate = multivariateFromOptions(options)
  const groupDimensions = groupDimensionsFromOptions(options)
  const noiseOptions = noiseOptionsFromOptions(options)
  const constraints = constraintEvaluatorsFromOptions(options)
  const acquisition = acquisitionFromOptions(options)
  const stream = new Rng.NumPyStream(seed)
  const startupStream = new Rng.NumPyStream(seed)

  return new Sampler.Sampler({
    kind: Sampler.Tpe({ options: snapshotOptions }),
    pendingImputationPolicy,
    checkpoint: Effect.all({ rng: stream.snapshot, startupRng: startupStream.snapshot }).pipe(Effect.map((states) => ({
      _tag: "Tpe",
      seed,
      nStartupTrials: startupTrials,
      nEiCandidates: nCandidates,
      ...states
    }))),
    restore: (checkpoint) => restoreCheckpoint(seed, startupTrials, nCandidates, stream, startupStream, checkpoint),
    suggest: (space, context) =>
      validateOptions(options).pipe(
        Effect.flatMap(() =>
          suggestWithStartup(
            (space) => startupStream.get.pipe(Effect.flatMap((rng) => suggestRandom(rng, space))),
            stream.get,
            startupTrials,
            nCandidates,
            multivariate,
            groupDimensions,
            noiseOptions,
            constraints,
            acquisition,
            space,
            new Sampler.Context({
              completed: context.completed,
              pruned: Option.fromNullishOr(context.pruned).pipe(Option.getOrElse(() => [])),
              pending: Bool.match(Equal.equals(pendingImputationPolicy.name, "none"), {
                onFalse: () => context.pending,
                onTrue: () => Arr.empty()
              }),
              objectiveSpec: context.objectiveSpec,
              nextTrialNumber: context.nextTrialNumber,
              epsilon: context.epsilon
            })
          )
        )
      )
  })
}
