/**
 * Constructors for built-in sampling strategies.
 *
 * @since 0.1.0
 */
import {
  type CmaEsOptions,
  constantLiarPolicy,
  type GpBoOptions,
  type GridOptions,
  pendingAsZeroPolicy,
  type RandomOptions,
  type Sampler,
  type TpeOptions
} from "../../Sampler.js"
import * as TpeSampler from "../tpe/sampler.js"
import * as CmaEsSampler from "./cmaEs/sampler.js"
import * as GpBoSampler from "./gpBo/sampler.js"
import * as GridSampler from "./grid.js"
import * as RandomSampler from "./random.js"

/**
 * Draws each active dimension from its declared distribution.
 *
 * @remarks
 * Suggestions are derived from the seed and `Context.nextTrialNumber`.
 * Repeating both against the same search space produces the same configuration.
 *
 * @param options - Uses seed `0` when omitted.
 * @since 0.1.0
 * @category constructors
 */
export const random = (options: RandomOptions = {}): Sampler => RandomSampler.make(options, pendingAsZeroPolicy)

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
export const grid = (options: GridOptions = {}): Sampler => GridSampler.make(options, pendingAsZeroPolicy)

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
export const tpe = (options: TpeOptions = {}): Sampler => TpeSampler.make(options, constantLiarPolicy)

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
export const cmaEs = (options: CmaEsOptions = {}): Sampler => CmaEsSampler.make(options, constantLiarPolicy)

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
export const gpBo = (options: GpBoOptions = {}): Sampler => GpBoSampler.make(options, constantLiarPolicy)
