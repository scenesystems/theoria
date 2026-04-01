/**
 * CMA-ES option parsing and validation.
 *
 * @since 0.1.0
 */
import { Effect, Number as Num, Option } from "effect"

import { InvalidSamplerConfig } from "../../Errors/index.js"
import type { CmaEsOptions } from "../../Sampler/index.js"
import { numberOptionOr } from "../../Sampler/shared/optionReaders.js"

const DEFAULT_SIGMA = 0.35
const DEFAULT_POPULATION_SIZE = 12

/**
 * Runtime option shape accepted by the CMA-ES sampler constructor.
 *
 * @since 0.1.0
 * @category models
 */
export type CmaEsRuntimeOptions = CmaEsOptions

/**
 * Reads the deterministic seed for CMA-ES sampling.
 *
 * @since 0.1.0
 * @category operations
 */
export const seedFromOptions = (options: CmaEsOptions): number => numberOptionOr(Option.fromNullable(options.seed), 0)

/**
 * Reads the global CMA-ES step-size (`sigma`) hyperparameter.
 *
 * @since 0.1.0
 * @category operations
 */
export const sigmaFromOptions = (options: CmaEsOptions): number =>
  numberOptionOr(Option.fromNullable(options.sigma), DEFAULT_SIGMA)

/**
 * Reads the per-generation population size.
 *
 * @since 0.1.0
 * @category operations
 */
export const populationSizeFromOptions = (options: CmaEsOptions): number =>
  numberOptionOr(Option.fromNullable(options.populationSize), DEFAULT_POPULATION_SIZE)

/**
 * Produces checkpoint-safe CMA-ES options without runtime closures.
 *
 * @since 0.1.0
 * @category operations
 */
export const snapshotSafeOptions = (options: CmaEsOptions): CmaEsOptions => ({
  seed: options.seed,
  sigma: options.sigma,
  populationSize: options.populationSize
})

const invalidConfig = (reason: string): InvalidSamplerConfig =>
  new InvalidSamplerConfig({
    reason,
    sampler: "cma-es"
  })

/**
 * Validates CMA-ES runtime options before sampler execution.
 *
 * @since 0.1.0
 * @category operations
 */
export const validateOptions = (options: CmaEsOptions): Effect.Effect<void, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const sigma = sigmaFromOptions(options)
    const populationSize = populationSizeFromOptions(options)

    yield* Effect.when(
      Effect.fail(invalidConfig("cma-es sampler requires sigma to be finite and > 0")),
      () => !Number.isFinite(sigma) || Num.lessThanOrEqualTo(sigma, 0)
    )

    yield* Effect.when(
      Effect.fail(invalidConfig("cma-es sampler requires populationSize to be finite and >= 2")),
      () => !Number.isFinite(populationSize) || Num.lessThan(populationSize, 2)
    )
  })
