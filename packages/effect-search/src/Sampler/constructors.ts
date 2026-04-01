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
 * Uniform random configuration sampling with optional seed for deterministic
 * replay. Best for initial exploration, baselines, and small search spaces.
 *
 * @see {@link Sampler}
 * @see {@link RandomOptions}
 * @see {@link SearchSpace}
 *
 * @since 0.1.0
 * @category constructors
 */
export const random = (options: RandomOptions = {}): Sampler =>
  RandomSampler.make(options, pendingAsZeroImputationPolicy)

/**
 * Exhaustive grid search over the Cartesian product of dimension values.
 * Optionally shuffled for randomized traversal order, which can improve
 * early-stopping quality by avoiding correlated sweeps.
 *
 * @see {@link Sampler}
 * @see {@link GridOptions}
 * @see {@link SearchSpace}
 *
 * @since 0.1.0
 * @category constructors
 */
export const grid = (options: GridOptions = {}): Sampler => GridSampler.make(options, pendingAsZeroImputationPolicy)

/**
 * Tree-structured Parzen Estimator — Bayesian optimization that models the
 * density ratio of promising vs unpromising configurations. Falls back to
 * random sampling during the startup phase (`nStartupTrials`).
 *
 * @see {@link Sampler}
 * @see {@link TpeRuntimeOptions}
 * @see {@link SearchSpace}
 *
 * @since 0.1.0
 * @category constructors
 */
export const tpe = (options: TpeRuntimeOptions = {}): Sampler =>
  TpeSampler.make(options, constantLiarPendingImputationPolicy)

/**
 * Covariance Matrix Adaptation Evolution Strategy for continuous
 * single-objective optimization.
 *
 * @since 0.1.0
 * @category constructors
 */
export const cmaEs = (options: CmaEsRuntimeOptions = {}): Sampler =>
  CmaEsSampler.make(options, constantLiarPendingImputationPolicy)

/**
 * Gaussian-process-inspired Bayesian optimization for continuous
 * single-objective optimization with TPE-compatible acquisition labels.
 *
 * @since 0.1.0
 * @category constructors
 */
export const gpBo = (options: GpBoRuntimeOptions = {}): Sampler =>
  GpBoSampler.make(options, constantLiarPendingImputationPolicy)
