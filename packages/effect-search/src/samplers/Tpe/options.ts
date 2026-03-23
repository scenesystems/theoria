import { Effect, Number as Num, Option } from "effect"

import { InvalidSamplerConfig } from "../../Errors/index.js"
import { defaultNoiseBandwidthOptions, NoiseBandwidthOptions } from "../../internal/tpe/noiseEstimator.js"
import type { TpeOptions } from "../../Sampler/index.js"
import { numberOptionOr } from "../../Sampler/shared/optionReaders.js"
import { type AcquisitionImplementation, type AcquisitionOption, resolveAcquisition } from "./acquisition/index.js"

const DEFAULT_NOISE_ALPHA = 1
const MAX_NOISE_ALPHA = 10

export type TpeConstraintEvaluator = (config: unknown) => Effect.Effect<number, never, never>

export type TpeRuntimeOptions = TpeOptions & {
  readonly constraints?: ReadonlyArray<TpeConstraintEvaluator>
  readonly acquisition?: AcquisitionOption
}

export const acquisitionFromOptions = (
  options: TpeRuntimeOptions
): AcquisitionImplementation => resolveAcquisition(options.acquisition)

export const constraintEvaluatorsFromOptions = (
  options: TpeRuntimeOptions
): ReadonlyArray<TpeConstraintEvaluator> =>
  Option.fromNullable(options.constraints).pipe(
    Option.getOrElse(() => [])
  )

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

export const startupTrialsFromOptions = (options: TpeOptions): number =>
  numberOptionOr(Option.fromNullable(options.nStartupTrials), 10)

export const candidatesFromOptions = (options: TpeOptions): number =>
  numberOptionOr(Option.fromNullable(options.nEiCandidates), 24)

export const seedFromOptions = (options: TpeOptions): number => numberOptionOr(Option.fromNullable(options.seed), 0)

export const multivariateFromOptions = (options: TpeOptions): boolean =>
  Option.fromNullable(options.multivariate).pipe(Option.getOrElse(() => false))

export const groupDimensionsFromOptions = (options: TpeOptions): boolean =>
  Option.fromNullable(options.groupDimensions).pipe(Option.getOrElse(() => false))

export const noiseAwareFromOptions = (options: TpeOptions): boolean =>
  Option.fromNullable(options.noiseAware).pipe(
    Option.getOrElse(() => defaultNoiseBandwidthOptions.noiseAware)
  )

export const noiseAlphaFromOptions = (options: TpeOptions): number =>
  numberOptionOr(
    Option.fromNullable(options.noiseAlpha),
    defaultNoiseBandwidthOptions.noiseAlpha || DEFAULT_NOISE_ALPHA
  )

export const noiseOptionsFromOptions = (
  options: TpeOptions
): NoiseBandwidthOptions =>
  new NoiseBandwidthOptions({
    noiseAware: noiseAwareFromOptions(options),
    noiseAlpha: noiseAlphaFromOptions(options)
  })

export const invalidConfig = (reason: string): InvalidSamplerConfig =>
  new InvalidSamplerConfig({
    reason,
    sampler: "tpe"
  })

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
