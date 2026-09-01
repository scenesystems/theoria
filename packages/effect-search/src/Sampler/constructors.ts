/**
 * Constructor functions for creating sampler instances (random, grid, and TPE) with default imputation policies.
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
 * Creates a sampler that draws every dimension independently from its declared
 * distribution. A fixed seed and trial number produce the same suggestion.
 *
 * @see {@link Sampler}
 * @see {@link RandomOptions}
 * @see {@link SearchSpace}
 *
 * @param options - Seed used by the per-trial random generator.
 * @since 0.1.0
 * @category constructors
 */
export const random = (options: RandomOptions = {}): Sampler =>
  RandomSampler.make(options, pendingAsZeroImputationPolicy)

/**
 * Creates an exhaustive sampler for finite search spaces.
 *
 * @remarks
 * Creates a sampler that enumerates the Cartesian product of finite dimension
 * values. Continuous distributions are rejected with
 * `SamplerSearchSpaceUnsupported`; requesting a trial after the grid is
 * exhausted fails with `SamplerExhausted`. Shuffling changes the deterministic
 * traversal order but not the configurations in the grid.
 *
 * @see {@link Sampler}
 * @see {@link GridOptions}
 * @see {@link SearchSpace}
 *
 * @param options - Traversal order and seed.
 * @since 0.1.0
 * @category constructors
 */
export const grid = (options: GridOptions = {}): Sampler => GridSampler.make(options, pendingAsZeroImputationPolicy)

/**
 * Creates a Tree-structured Parzen Estimator sampler. It uses random sampling
 * until `nStartupTrials` completed observations are available, then scores
 * `nEiCandidates` model candidates. It supports float, integer, categorical,
 * and conditional dimensions and single- or multi-objective studies.
 *
 * @see {@link Sampler}
 * @see {@link TpeOptions}
 * @see {@link SearchSpace}
 *
 * @param options - TPE model, acquisition, constraint, and seed settings.
 * @since 0.1.0
 * @category constructors
 */
export const tpe = (options: TpeRuntimeOptions = {}): Sampler =>
  TpeSampler.make(options, constantLiarPendingImputationPolicy)

/**
 * Creates a CMA-ES sampler for unconditional float dimensions and a
 * single-objective study. Other dimension kinds, conditional spaces, and
 * multi-objective contexts fail through the sampler's typed error channel.
 *
 * @param options - Seed, initial step size, and generation population size.
 * @since 0.1.0
 * @category constructors
 */
export const cmaEs = (options: CmaEsRuntimeOptions = {}): Sampler =>
  CmaEsSampler.make(options, constantLiarPendingImputationPolicy)

/**
 * Creates a Gaussian-process Bayesian optimization sampler.
 *
 * @remarks
 * Creates Gaussian-process Bayesian optimization for unconditional float
 * dimensions and a single-objective study. Suggestions are random during
 * `nStartupTrials`; later suggestions maximize the configured acquisition over
 * `nCandidates` seeded candidates. Unsupported spaces and objectives fail
 * through the sampler's typed error channel.
 *
 * @param options - GP, acquisition, startup, candidate, and seed settings.
 * @since 0.1.0
 * @category constructors
 */
export const gpBo = (options: GpBoRuntimeOptions = {}): Sampler =>
  GpBoSampler.make(options, constantLiarPendingImputationPolicy)
