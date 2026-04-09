/**
 * Learnable LLM program modules — constructors for `predict`, `chainOfThought`,
 * `programOfThought`, `multiChainComparison`, `parallel`, `react`, `bestOfN`,
 * `refine`, and `compose` modules, plus discovery and parameter persistence.
 *
 * @since 0.1.0
 */

/**
 * Core `Module` class and `SavedState` envelope for parameter persistence.
 *
 * @since 0.1.0
 */
export * from "./model.js"

/**
 * The `predict` constructor — creates a leaf module that calls a language
 * model to transform input to output.
 *
 * @since 0.1.0
 */
export * from "./predict/index.js"

/**
 * Predict policy owner namespace.
 *
 * @since 0.2.0
 */
export { PredictPolicy } from "./predict/policy.js"

/**
 * The `chainOfThought` constructor — wraps a signature with a mandatory
 * `reasoning` output field.
 *
 * @since 0.1.0
 */
export * from "./chainOfThought/index.js"

/**
 * The `programOfThought` constructor — generates executable code, runs it
 * through an injected interpreter boundary, repairs failures, and projects
 * the final answer back onto the original signature.
 *
 * @since 0.2.0
 */
export * from "./programOfThought/index.js"

/**
 * The `multiChainComparison` constructor — runs multiple reasoning chains,
 * compares them in a final verdict pass, and projects the best answer back
 * onto the original signature.
 *
 * @since 0.2.0
 */
export * from "./multiChainComparison/index.js"

/**
 * The `parallel` constructor — fans out a wrapped module over ordered batch
 * inputs with explicit concurrency and failure-policy control.
 *
 * @since 0.2.0
 */
export * from "./parallel/index.js"

/**
 * The `react` constructor — creates a module that interleaves tool calls
 * and reasoning across multiple iterations.
 *
 * @since 0.1.0
 */
export * from "./react/index.js"

/**
 * The `bestOfN` constructor — runs a module N times with distinct rollout
 * identities and returns the highest-scoring candidate.
 *
 * @since 0.1.0
 */
export * from "./bestOfN/index.js"

/**
 * The `refine` constructor — iteratively improves module output by feeding
 * reward feedback back into the prompt.
 *
 * @since 0.1.0
 */
export * from "./refine/index.js"

/**
 * The `compose` constructor — builds multi-module pipelines with validated
 * composition graphs.
 *
 * @since 0.1.0
 */
export * from "./compose/index.js"

/**
 * Module discovery via FiberRef — registers modules during execution for
 * optimizer graph construction.
 *
 * @since 0.1.0
 */
export * from "./discovery/index.js"

/**
 * Parameter persistence — `save` and `load` serialize module state via
 * Schema envelopes.
 *
 * @since 0.1.0
 */
export * from "./save-load.js"
