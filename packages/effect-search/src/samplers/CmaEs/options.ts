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

export type CmaEsRuntimeOptions = CmaEsOptions

export const seedFromOptions = (options: CmaEsOptions): number => numberOptionOr(Option.fromNullable(options.seed), 0)

export const sigmaFromOptions = (options: CmaEsOptions): number =>
  numberOptionOr(Option.fromNullable(options.sigma), DEFAULT_SIGMA)

export const populationSizeFromOptions = (options: CmaEsOptions): number =>
  numberOptionOr(Option.fromNullable(options.populationSize), DEFAULT_POPULATION_SIZE)

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
