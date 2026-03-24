/**
 * TPE option parsing — default resolution and validation for TPE sampler configuration.
 *
 * @since 0.1.0
 */
import { Effect, Number as Num, Option } from "effect"

import { InvalidSamplerConfig } from "../../Errors/index.js"
import { defaultNoiseBandwidthOptions, NoiseBandwidthOptions } from "../../internal/tpe/noiseEstimator.js"
import type { TpeOptions } from "../../Sampler/index.js"
import { numberOptionOr } from "../../Sampler/shared/optionReaders.js"
import { type AcquisitionImplementation, type AcquisitionOption, resolveAcquisition } from "./acquisition/index.js"

const DEFAULT_NOISE_ALPHA = 1
const MAX_NOISE_ALPHA = 10

/**
 * Evaluates a candidate config against a single constraint, returning a numeric
 * feasibility score where ≤ 0 indicates the constraint is satisfied.
 *
 * Constraint evaluators are applied during the split phase to separate feasible
 * from infeasible trials, enabling constrained Bayesian optimization without
 * modifying the objective function.
 *
 * @see {@link TpeRuntimeOptions} for registering constraints at sampler construction
 * @see {@link constraintEvaluatorsFromOptions} for extracting evaluators at runtime
 * @since 0.1.0
 * @category models
 */
export type TpeConstraintEvaluator = (config: unknown) => Effect.Effect<number, never, never>

/**
 * Extended TPE options that include runtime-only fields not persisted in
 * checkpoints — constraint evaluators and acquisition strategy.
 *
 * These fields carry live function references that cannot be serialized,
 * so they are stripped by {@link snapshotSafeOptionsFromRuntime} before
 * checkpoint persistence.
 *
 * @see {@link snapshotSafeOptionsFromRuntime} for the checkpoint-safe projection
 * @see {@link TpeConstraintEvaluator} for the constraint function signature
 * @since 0.1.0
 * @category models
 */
export type TpeRuntimeOptions = TpeOptions & {
  readonly constraints?: ReadonlyArray<TpeConstraintEvaluator>
  readonly acquisition?: AcquisitionOption
}

/**
 * Resolves the acquisition function implementation from runtime options,
 * defaulting to the standard expected-improvement (EI) strategy.
 *
 * The acquisition function scores each candidate by comparing its log-density
 * under the below-distribution l(x) to the above-distribution g(x).
 *
 * @see {@link TpeRuntimeOptions} for the options shape
 * @since 0.1.0
 * @category configuration
 */
export const acquisitionFromOptions = (
  options: TpeRuntimeOptions
): AcquisitionImplementation => resolveAcquisition(options.acquisition)

/**
 * Extracts constraint evaluator functions from runtime options, returning an
 * empty array when none are configured.
 *
 * Used by the split phase to compute per-trial feasibility scores before
 * partitioning into below/above groups.
 *
 * @see {@link TpeConstraintEvaluator} for the evaluator signature
 * @see {@link TpeRuntimeOptions} for the options shape
 * @since 0.1.0
 * @category configuration
 */
export const constraintEvaluatorsFromOptions = (
  options: TpeRuntimeOptions
): ReadonlyArray<TpeConstraintEvaluator> =>
  Option.fromNullable(options.constraints).pipe(
    Option.getOrElse(() => [])
  )

/**
 * Strips runtime-only fields (constraints, acquisition) from options to produce
 * a checkpoint-safe snapshot containing only serializable configuration.
 *
 * When constraints are present, their count is preserved as `constraintsCount`
 * so checkpoint restore can validate structural consistency.
 *
 * @see {@link TpeRuntimeOptions} for the full options including runtime fields
 * @since 0.1.0
 * @category configuration
 */
export const snapshotSafeOptionsFromRuntime = (
  options: TpeRuntimeOptions
): TpeOptions => {
  const baseOptions: TpeOptions = {
    nStartupTrials: options.nStartupTrials,
    nEiCandidates: options.nEiCandidates,
    multivariate: options.multivariate,
    groupDimensions: options.groupDimensions,
    noiseAware: options.noiseAware,
    noiseAlpha: options.noiseAlpha,
    seed: options.seed
  }

  return Option.fromNullable(options.constraints).pipe(
    Option.filter((constraints) => constraints.length > 0),
    Option.match({
      onNone: () => baseOptions,
      onSome: (constraints) => ({
        ...baseOptions,
        constraintsCount: constraints.length
      })
    })
  )
}

/**
 * Reads the number of random startup trials before model-driven sampling
 * begins, defaulting to 10.
 *
 * During startup, the sampler delegates to uniform random sampling to build
 * an initial observation set for kernel density estimation.
 *
 * @see {@link candidatesFromOptions} for the post-startup candidate count
 * @see {@link validateOptions} for range validation
 * @since 0.1.0
 * @category configuration
 */
export const startupTrialsFromOptions = (options: TpeOptions): number =>
  numberOptionOr(Option.fromNullable(options.nStartupTrials), 10)

/**
 * Reads the number of EI candidates to draw per suggestion step, defaulting
 * to 24.
 *
 * More candidates improve acquisition function coverage at the cost of
 * additional kernel density evaluations per suggestion.
 *
 * @see {@link startupTrialsFromOptions} for the pre-model phase count
 * @see {@link validateOptions} for range validation
 * @since 0.1.0
 * @category configuration
 */
export const candidatesFromOptions = (options: TpeOptions): number =>
  numberOptionOr(Option.fromNullable(options.nEiCandidates), 24)

/**
 * Reads the RNG seed for deterministic sampling, defaulting to 0.
 *
 * The seed initializes the LCG-based PRNG, ensuring reproducible candidate
 * draws and kernel density estimation across identical trial histories.
 *
 * @see {@link startupTrialsFromOptions} for the random-phase configuration
 * @since 0.1.0
 * @category configuration
 */
export const seedFromOptions = (options: TpeOptions): number => numberOptionOr(Option.fromNullable(options.seed), 0)

/**
 * Reads whether correlated multivariate continuous sampling is enabled,
 * defaulting to false (independent per-dimension).
 *
 * When true, continuous dimensions are modeled jointly via diagonal Gaussian
 * mixtures that capture inter-parameter correlations, improving sample
 * efficiency for correlated search spaces.
 *
 * @see {@link groupDimensionsFromOptions} for mixed-type dimension grouping
 * @since 0.1.0
 * @category configuration
 */
export const multivariateFromOptions = (options: TpeOptions): boolean =>
  Option.fromNullable(options.multivariate).pipe(Option.getOrElse(() => false))

/**
 * Reads whether dimension grouping is enabled for mixed-type search spaces,
 * defaulting to false.
 *
 * When enabled, continuous and categorical dimensions are grouped separately
 * so each group builds its own Parzen estimator, then scores are combined
 * in the joint mixed-space selection phase.
 *
 * @see {@link multivariateFromOptions} for continuous-only correlation
 * @since 0.1.0
 * @category configuration
 */
export const groupDimensionsFromOptions = (options: TpeOptions): boolean =>
  Option.fromNullable(options.groupDimensions).pipe(Option.getOrElse(() => false))

/**
 * Reads whether noise-aware bandwidth estimation is enabled, falling back to
 * the default noise estimator setting.
 *
 * Noise-aware bandwidth adds regularization to the Parzen estimator kernel
 * widths, improving robustness when observations are noisy.
 *
 * @see {@link noiseAlphaFromOptions} for the regularization strength
 * @see {@link noiseOptionsFromOptions} for the assembled options record
 * @since 0.1.0
 * @category configuration
 */
export const noiseAwareFromOptions = (options: TpeOptions): boolean =>
  Option.fromNullable(options.noiseAware).pipe(
    Option.getOrElse(() => defaultNoiseBandwidthOptions.noiseAware)
  )

/**
 * Reads the noise regularization alpha for bandwidth estimation, clamped to
 * [0, 10] at validation time.
 *
 * Higher alpha values increase regularization, widening kernel bandwidths
 * to smooth over observation noise at the cost of reduced model fidelity.
 *
 * @see {@link noiseAwareFromOptions} for the feature toggle
 * @see {@link validateOptions} for range enforcement
 * @since 0.1.0
 * @category configuration
 */
export const noiseAlphaFromOptions = (options: TpeOptions): number =>
  numberOptionOr(
    Option.fromNullable(options.noiseAlpha),
    defaultNoiseBandwidthOptions.noiseAlpha || DEFAULT_NOISE_ALPHA
  )

/**
 * Assembles a `NoiseBandwidthOptions` record from the resolved noise-aware
 * flag and alpha value.
 *
 * Combines the two noise-related option readers into a single record consumed
 * by the bandwidth estimation stage of Parzen estimator construction.
 *
 * @see {@link noiseAwareFromOptions} for the feature toggle
 * @see {@link noiseAlphaFromOptions} for the regularization strength
 * @since 0.1.0
 * @category configuration
 */
export const noiseOptionsFromOptions = (
  options: TpeOptions
): NoiseBandwidthOptions =>
  new NoiseBandwidthOptions({
    noiseAware: noiseAwareFromOptions(options),
    noiseAlpha: noiseAlphaFromOptions(options)
  })

/**
 * Constructs an `InvalidSamplerConfig` error tagged with the TPE sampler name
 * and the given reason string.
 *
 * Provides a consistent error factory so all TPE validation failures carry
 * the `"tpe"` sampler tag for structured error handling.
 *
 * @see {@link validateOptions} for the validation pipeline that uses this factory
 * @since 0.1.0
 * @category constructors
 */
export const invalidConfig = (reason: string): InvalidSamplerConfig =>
  new InvalidSamplerConfig({
    reason,
    sampler: "tpe"
  })

/**
 * Validates resolved TPE options, failing with `InvalidSamplerConfig` if
 * startup trials, candidate count, or noise alpha are out of range or
 * non-finite.
 *
 * Called once during sampler construction to catch configuration errors
 * before any trials are run, preventing wasted computation.
 *
 * @see {@link invalidConfig} for the error factory
 * @see {@link startupTrialsFromOptions} for default resolution
 * @since 0.1.0
 * @category guards
 */
export const validateOptions = (
  options: TpeOptions
): Effect.Effect<void, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const startup = startupTrialsFromOptions(options)
    const candidates = candidatesFromOptions(options)
    const noiseAlpha = noiseAlphaFromOptions(options)

    yield* Effect.when(
      Effect.fail(
        new InvalidSamplerConfig({
          reason: "tpe sampler requires nStartupTrials >= 0",
          sampler: "tpe"
        })
      ),
      () => Num.lessThan(startup, 0)
    )

    yield* Effect.when(
      Effect.fail(
        new InvalidSamplerConfig({
          reason: "tpe sampler requires nEiCandidates >= 1",
          sampler: "tpe"
        })
      ),
      () => Num.lessThan(candidates, 1)
    )

    yield* Effect.when(
      Effect.fail(
        new InvalidSamplerConfig({
          reason: "tpe sampler requires noiseAlpha to be finite",
          sampler: "tpe"
        })
      ),
      () => !Number.isFinite(noiseAlpha)
    )

    yield* Effect.when(
      Effect.fail(
        new InvalidSamplerConfig({
          reason: `tpe sampler requires noiseAlpha to be between 0 and ${MAX_NOISE_ALPHA}`,
          sampler: "tpe"
        })
      ),
      () => Num.lessThan(noiseAlpha, 0) || Num.greaterThan(noiseAlpha, MAX_NOISE_ALPHA)
    )
  })
