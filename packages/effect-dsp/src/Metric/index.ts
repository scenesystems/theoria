/**
 * Scoring metrics for evaluating module predictions.
 *
 * @since 0.1.0
 */

/**
 * Core `Metric` class and `Result` model.
 *
 * @since 0.1.0
 */
export * from "./model.js"

/**
 * Full scoring context preserved across evaluation and optimizer loops.
 *
 * @since 0.2.0
 */
export * from "./context.js"

/**
 * Constructors — `make` for pure scoring functions, `fromEffect` for
 * effectful ones, plus contextual variants.
 *
 * @since 0.1.0
 */
export * from "./constructors.js"

/**
 * Built-in metrics — `exactMatch`, `f1`, and `contains`.
 *
 * @since 0.1.0
 */
export * from "./builtins.js"

/**
 * Composition — `compose` multiple metrics into one averaged metric.
 *
 * @since 0.1.0
 */
export * from "./compose.js"
