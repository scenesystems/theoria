/**
 * I/O signatures — Schema-based type contracts defining module input and output.
 *
 * @since 0.1.0
 * @category signatures
 */
export * as Signature from "./Signature/index.js"

/**
 * Learnable LLM program modules — predict, chainOfThought, compose, and
 * persistence.
 *
 * @since 0.1.0
 * @category modules
 */
export * as Module from "./Module/index.js"

/**
 * Prompt optimizers — BootstrapFewShot, BootstrapRS, LabeledFewShot, MIPROv2,
 * GEPA, Ensemble, and progress reporting.
 *
 * @since 0.1.0
 * @category optimizers
 */
export * as Optimizer from "./Optimizer/index.js"

/**
 * Scoring metrics — exactMatch, f1, contains, custom metrics, and metric
 * composition.
 *
 * @since 0.1.0
 * @category metrics
 */
export * as Metric from "./Metric/index.js"

/**
 * Dataset evaluation — batch run or streaming stream against labeled examples.
 *
 * @since 0.1.0
 * @category evaluation
 */
export * as Evaluate from "./Evaluate/index.js"

/**
 * Training data — Example and Demo types for optimization datasets.
 *
 * @since 0.1.0
 * @category examples
 */
export * as Example from "./Example/index.js"

/**
 * Execution tracing — fiber-scoped trace collection and token usage accounting.
 *
 * @since 0.1.0
 * @category tracing
 */
export * as Trace from "./Trace/index.js"

/**
 * Typed errors — Schema.TaggedError classes for every failure domain.
 *
 * @since 0.1.0
 * @category errors
 */
export * as Errors from "./Errors/index.js"

/**
 * Shared cache authority — module-level LM call memoization with rollout
 * partitioning.
 *
 * @since 0.1.0
 * @category cache
 */
export * as Cache from "./Cache/index.js"
