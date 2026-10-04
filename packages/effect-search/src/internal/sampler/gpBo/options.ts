/**
 * GP-BO option parsing and validation.
 *
 * @since 0.1.0
 */
import { isFinite } from "@scenesystems/effect-math/Numeric"
import { Boolean as Bool, Effect, Number as Num, Option } from "effect"

import type { GpBoOptions } from "../../../Sampler.js"
import { InvalidSamplerConfig } from "../../../SearchError.js"
import { numberOptionOr } from "../optionReaders.js"

const defaultStartupTrials = 8
const defaultCandidates = 32
const defaultLengthScale = 0.25
const defaultNoise = 0.01

/**
 * Runtime option shape accepted by the GP-BO sampler constructor.
 *
 * @since 0.1.0
 * @category models
 */
export type GpBoRuntimeOptions = GpBoOptions

/**
 * Reads the deterministic seed for GP-BO sampling.
 *
 * @since 0.1.0
 * @category operations
 */
export const seedFromOptions = (options: GpBoOptions): number => numberOptionOr(Option.fromNullishOr(options.seed), 0)

/**
 * Reads the random-startup trial budget used before GP posterior fitting.
 *
 * @since 0.1.0
 * @category operations
 */
export const startupTrialsFromOptions = (options: GpBoOptions): number =>
  numberOptionOr(Option.fromNullishOr(options.nStartupTrials), defaultStartupTrials)

/**
 * Reads the per-step candidate count used for acquisition scoring.
 *
 * @since 0.1.0
 * @category operations
 */
export const candidatesFromOptions = (options: GpBoOptions): number =>
  numberOptionOr(Option.fromNullishOr(options.nCandidates), defaultCandidates)

/**
 * Reads the RBF kernel length-scale hyperparameter.
 *
 * @since 0.1.0
 * @category operations
 */
export const lengthScaleFromOptions = (options: GpBoOptions): number =>
  numberOptionOr(Option.fromNullishOr(options.lengthScale), defaultLengthScale)

/**
 * Reads the GP diagonal noise jitter hyperparameter.
 *
 * @since 0.1.0
 * @category operations
 */
export const noiseFromOptions = (options: GpBoOptions): number =>
  numberOptionOr(Option.fromNullishOr(options.noise), defaultNoise)

/**
 * Produces checkpoint-safe GP-BO options without runtime closures.
 *
 * @since 0.1.0
 * @category operations
 */
export const snapshotSafeOptions = (options: GpBoOptions): GpBoOptions => ({
  seed: options.seed,
  nStartupTrials: options.nStartupTrials,
  nCandidates: options.nCandidates,
  lengthScale: options.lengthScale,
  noise: options.noise,
  acquisition: options.acquisition
})

const invalidConfig = (reason: string): InvalidSamplerConfig =>
  new InvalidSamplerConfig({
    reason,
    sampler: "gp-bo"
  })

/**
 * Validates GP-BO runtime options before sampler execution.
 *
 * @since 0.1.0
 * @category operations
 */
export const validateOptions = (options: GpBoOptions): Effect.Effect<void, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const startup = startupTrialsFromOptions(options)
    const candidates = candidatesFromOptions(options)
    const lengthScale = lengthScaleFromOptions(options)
    const noise = noiseFromOptions(options)

    yield* Effect.when(
      Effect.fail(invalidConfig("gp-bo sampler requires nStartupTrials >= 0")),
      Effect.succeed(Bool.or(Bool.not(isFinite(startup)), Num.isLessThan(startup, 0)))
    )

    yield* Effect.when(
      Effect.fail(invalidConfig("gp-bo sampler requires nCandidates >= 1")),
      Effect.succeed(Bool.or(Bool.not(isFinite(candidates)), Num.isLessThan(candidates, 1)))
    )

    yield* Effect.when(
      Effect.fail(invalidConfig("gp-bo sampler requires lengthScale to be finite and > 0")),
      Effect.succeed(Bool.or(Bool.not(isFinite(lengthScale)), Num.isLessThanOrEqualTo(lengthScale, 0)))
    )

    yield* Effect.when(
      Effect.fail(invalidConfig("gp-bo sampler requires noise to be finite and >= 0")),
      Effect.succeed(Bool.or(Bool.not(isFinite(noise)), Num.isLessThan(noise, 0)))
    )
  })
