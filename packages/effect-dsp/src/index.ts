/**
 * Executes schema-validated language-model programs in Effect workflows.
 *
 * @remarks
 * `Signature` defines the runtime input and output boundary. `Module` executes
 * that contract. Evaluation and optimization score module behavior over labeled
 * examples, while cache and trace services alter execution observability and reuse.
 *
 * @since 0.1.0
 * @module
 */

/**
 * Builds schema-backed input and output contracts with prompt metadata.
 *
 * @since 0.1.0
 * @category signatures
 */
export * as Signature from "./Signature/index.js"

/**
 * Constructs executable model programs and exposes their learnable parameter state.
 *
 * @since 0.1.0
 * @category modules
 */
export * as Module from "./Module/index.js"

/**
 * Derives module instructions and demonstrations from examples and metric scores.
 *
 * @since 0.1.0
 * @category optimizers
 */
export * as Optimizer from "./Optimizer/index.js"

/**
 * Scores predictions with effectful or synchronous metrics and composes their results.
 *
 * @since 0.1.0
 * @category metrics
 */
export * as Metric from "./Metric/index.js"

/**
 * Evaluates modules over labeled datasets and emits per-example lifecycle events.
 *
 * @since 0.1.0
 * @category evaluation
 */
export * as Evaluate from "./Evaluate/index.js"

/**
 * Models input-only and labeled rows used by evaluation and optimization.
 *
 * @since 0.1.0
 * @category models
 */
export * as Example from "./Example/index.js"

/**
 * Collects module-call records and usage totals in fiber-local scopes.
 *
 * @since 0.1.0
 * @category tracing
 */
export * as Trace from "./Trace/index.js"

/**
 * Describes the tagged failures returned by DSP operations.
 *
 * @since 0.1.0
 * @category errors
 */
export * as Errors from "./Errors/index.js"

/**
 * Memoizes model results with optional rollout-specific cache partitions.
 *
 * @since 0.1.0
 * @category cache
 */
export * as Cache from "./Cache/index.js"
