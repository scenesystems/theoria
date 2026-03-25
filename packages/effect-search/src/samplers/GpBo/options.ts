/**
 * GP-BO option parsing and validation.
 *
 * @since 0.1.0
 */
import { Effect, Number as Num, Option } from "effect"

import { InvalidSamplerConfig } from "../../Errors/index.js"
import type { GpBoOptions } from "../../Sampler/index.js"
import { numberOptionOr } from "../../Sampler/shared/optionReaders.js"

const DEFAULT_STARTUP_TRIALS = 8
const DEFAULT_CANDIDATES = 32
const DEFAULT_LENGTH_SCALE = 0.25
const DEFAULT_NOISE = 0.01

export type GpBoRuntimeOptions = GpBoOptions

export const seedFromOptions = (options: GpBoOptions): number => numberOptionOr(Option.fromNullable(options.seed), 0)

export const startupTrialsFromOptions = (options: GpBoOptions): number =>
  numberOptionOr(Option.fromNullable(options.nStartupTrials), DEFAULT_STARTUP_TRIALS)

export const candidatesFromOptions = (options: GpBoOptions): number =>
  numberOptionOr(Option.fromNullable(options.nCandidates), DEFAULT_CANDIDATES)

export const lengthScaleFromOptions = (options: GpBoOptions): number =>
  numberOptionOr(Option.fromNullable(options.lengthScale), DEFAULT_LENGTH_SCALE)

export const noiseFromOptions = (options: GpBoOptions): number =>
  numberOptionOr(Option.fromNullable(options.noise), DEFAULT_NOISE)

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

export const validateOptions = (options: GpBoOptions): Effect.Effect<void, InvalidSamplerConfig> =>
  Effect.gen(function*() {
    const startup = startupTrialsFromOptions(options)
    const candidates = candidatesFromOptions(options)
    const lengthScale = lengthScaleFromOptions(options)
    const noise = noiseFromOptions(options)

    yield* Effect.when(
      Effect.fail(invalidConfig("gp-bo sampler requires nStartupTrials >= 0")),
      () => !Number.isFinite(startup) || Num.lessThan(startup, 0)
    )

    yield* Effect.when(
      Effect.fail(invalidConfig("gp-bo sampler requires nCandidates >= 1")),
      () => !Number.isFinite(candidates) || Num.lessThan(candidates, 1)
    )

    yield* Effect.when(
      Effect.fail(invalidConfig("gp-bo sampler requires lengthScale to be finite and > 0")),
      () => !Number.isFinite(lengthScale) || Num.lessThanOrEqualTo(lengthScale, 0)
    )

    yield* Effect.when(
      Effect.fail(invalidConfig("gp-bo sampler requires noise to be finite and >= 0")),
      () => !Number.isFinite(noise) || Num.lessThan(noise, 0)
    )
  })
