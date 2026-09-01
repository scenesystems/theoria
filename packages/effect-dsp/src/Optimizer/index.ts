/**
 * Derives module parameters from examples and metrics through few-shot
 * selection, random search, Bayesian instruction search, ensembles, or
 * evolutionary prompt search.
 *
 * @remarks
 * Optimizers retain their algorithm-specific failure and event contracts. Use
 * `effectSearchInterop` when module parameters should be evaluated as
 * black-box search trials rather than through a built-in prompt optimizer.
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
 * `miprov2` — multi-phase instruction proposal and demonstration selection via
 * Bayesian optimization.
 *
 * @since 0.1.0
 */
export * from "./miprov2.js"

/**
 * `gepa` and `gepaWithEvents` — evolutionary prompt optimization with
 * teacher-student debate.
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
