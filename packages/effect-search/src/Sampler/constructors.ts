/**
 * Constructors for built-in sampling strategies.
 *
 * @since 0.1.0
 */
import { constantLiarPendingImputationPolicy } from "../internal/constantLiar.js"
import type { CmaEsRuntimeOptions } from "../samplers/CmaEs/options.js"
import * as CmaEsSampler from "../samplers/CmaEsSampler.js"
import type { GpBoRuntimeOptions } from "../samplers/GpBo/options.js"
import * as GpBoSampler from "../samplers/GpBoSampler.js"
import * as GridSampler from "../samplers/GridSampler.js"
import * as RandomSampler from "../samplers/RandomSampler.js"
import type { TpeRuntimeOptions } from "../samplers/Tpe/options.js"
import * as TpeSampler from "../samplers/TpeSampler.js"
import type { GridOptions, RandomOptions } from "./kinds.js"
import type { Sampler } from "./model.js"
import { pendingAsZeroImputationPolicy } from "./PendingImputationPolicy.js"

/**
 * Draws each active dimension from its declared distribution.
 *
 * @remarks
 * Suggestions are derived from the seed and `SuggestContext.nextTrialNumber`.
 * Repeating both against the same search space produces the same configuration.
 *
 * @param options - Uses seed `0` when omitted.
 * @since 0.1.0
 * @category constructors
 */
export const random = (options: RandomOptions = {}): Sampler =>
  RandomSampler.make(options, pendingAsZeroImputationPolicy)

/**
 * Enumerates the Cartesian product of a finite search space without recycling entries.
 *
 * @remarks
 * Categorical, boolean, and stepped integer dimensions are finite. Unsupported
 * dimensions fail with `GridIncompatible`; a trial number beyond the final
 * combination fails with `SamplerExhausted`. Shuffling changes traversal order
 * without changing the set of configurations.
 *
 * @param options - Defaults to ordered traversal with seed `0`.
 * @since 0.1.0
 * @category constructors
 */
export const grid = (options: GridOptions = {}): Sampler => GridSampler.make(options, pendingAsZeroImputationPolicy)

/**
 * Uses random startup suggestions followed by Tree-structured Parzen Estimator scoring.
 *
 * @remarks
 * Float, integer, categorical, conditional, single-objective, and
 * multi-objective searches are accepted. Runtime acquisition implementations
 * and constraint evaluators remain live functions and are excluded from the
 * sampler checkpoint; the number of constraints is retained in `kind.options`.
 * Invalid numeric options fail with `InvalidSamplerConfig` when `suggest` runs.
 *
 * @param options - Defaults to 10 startup trials, 24 scored candidates, seed
 * `0`, expected improvement, and independent noise-unaware models.
 * @since 0.1.0
 * @category constructors
 */
export const tpe = (options: TpeRuntimeOptions = {}): Sampler =>
  TpeSampler.make(options, constantLiarPendingImputationPolicy)

/**
 * Adapts a diagonal CMA-ES model to an unconditional continuous search space.
 *
 * @remarks
 * Suggestions reconstruct model state from complete generations in the trial
 * history. Unsupported dimensions fail with `SamplerSearchSpaceUnsupported`,
 * multi-objective contexts fail with `SamplerObjectiveUnsupported`, and invalid
 * numeric options fail with `InvalidSamplerConfig` when `suggest` runs.
 *
 * @param options - Defaults to seed `0`, initial sigma `0.35`, and population
 * size `12`.
 * @since 0.1.0
 * @category constructors
 */
export const cmaEs = (options: CmaEsRuntimeOptions = {}): Sampler =>
  CmaEsSampler.make(options, constantLiarPendingImputationPolicy)

/**
 * Fits a Gaussian process over an unconditional continuous search space.
 *
 * @remarks
 * Suggestions are random until the startup observation count is reached. Later
 * suggestions score seeded candidates and the current incumbent with the
 * configured acquisition. Unsupported dimensions, unsupported objective shape,
 * and invalid numeric options use the typed search error channel.
 *
 * @param options - Defaults to seed `0`, 8 startup trials, 32 candidates,
 * length scale `0.25`, diagonal noise `0.01`, and `"ei"` acquisition.
 * @since 0.1.0
 * @category constructors
 */
export const gpBo = (options: GpBoRuntimeOptions = {}): Sampler =>
  GpBoSampler.make(options, constantLiarPendingImputationPolicy)
