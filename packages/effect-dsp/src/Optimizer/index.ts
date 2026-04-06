/**
 * Prompt optimizer façade — entry points for all optimization algorithms and
 * their event/progress contracts.
 *
 * @since 0.1.0
 */

/**
 * Event schemas and constructors for all optimizer lifecycles.
 *
 * @since 0.1.0
 */
export * from "./events/index.js"

/**
 * `bootstrapFewShot` — collect high-scoring demonstrations from teacher runs.
 *
 * @since 0.1.0
 */
export * from "./bootstrapFewShot.js"

/**
 * `labeledFewShot` — select demonstrations from labeled training data.
 *
 * @since 0.1.0
 */
export * from "./labeledFewShot.js"

/**
 * `bootstrapRS` — random-search variant of BootstrapFewShot with multiple
 * restarts.
 *
 * @since 0.1.0
 */
export * from "./bootstrapRS.js"

/**
 * `ensemble` — combine and select the best parameters from multiple optimizer
 * runs.
 *
 * @since 0.1.0
 */
export * from "./ensemble.js"

/**
 * `miprov2` — Multiprompt Instruction PRoposal Optimizer v2: instruction and demonstration selection via
 * Bayesian optimization.
 *
 * @since 0.1.0
 */
export * from "./miprov2.js"

/**
 * `copro` — coordinate-ascent instruction optimization with step-boundary
 * snapshots and typed progress events.
 *
 * @since 0.2.0
 */
export * from "./copro.js"

/**
 * `gepa` and `gepaWithEvents` — Genetic-Pareto reflective prompt evolution
 * with LM-based reflection and evolutionary crossover.
 *
 * @since 0.1.0
 */
export * from "./gepa.js"

/**
 * `gepaStream` — project GEPA optimization events as an Effect Stream.
 *
 * @since 0.1.0
 */
export * from "./gepaStream.js"

/**
 * Progress formatting — `formatBootstrapEvent`, `formatMIPROv2Event`,
 * `formatGEPAEvent`, and semantic summary builders.
 *
 * @since 0.1.0
 */
export * from "./progress.js"

export {
  /**
   * Bridge between effect-dsp modules and effect-search black-box optimization.
   * Translates module parameters into search space trials.
   *
   * @since 0.1.0
   * @category constructors
   */
  effectSearchInterop
} from "../optimizers/effectSearchInterop/index.js"
