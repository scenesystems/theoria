/**
 * Optimizer event contracts — lifecycle events for evaluation, bootstrap,
 * MIPROv2, GEPA, and wrapped optimizer streams.
 *
 * @since 0.1.0
 */

/**
 * Evaluation lifecycle events — `ExampleStarted`, `ExampleCompleted`,
 * `ExampleFailed`, `EvaluationCompleted`.
 *
 * @since 0.1.0
 */
export * from "./evaluation.js"

/**
 * Bootstrap events — round progress, trace accept/reject, fallback activation.
 *
 * @since 0.1.0
 */
export * from "./bootstrap.js"

/**
 * MIPROv2 events — phase transitions, instruction proposals, trial outcomes.
 *
 * @since 0.1.0
 */
export * from "./miprov2.js"

/**
 * COPRO events — step progression, candidate proposals, and accepted updates.
 *
 * @since 0.2.0
 */
export * from "./copro.js"

/**
 * GEPA events — generation progress, merge/crossover, acceptance gates.
 *
 * @since 0.1.0
 */
export * from "./gepa.js"

/**
 * Wrapped events — `OptimizerEvent` discriminated union and envelope
 * projections.
 *
 * @since 0.1.0
 */
export * from "./optimizer.js"
