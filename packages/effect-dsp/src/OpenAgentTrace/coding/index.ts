/**
 * Shared coding-agent projections over normalized open-agent-trace records.
 *
 * @since 0.2.0
 */

/**
 * Dataset-level coding projections for normalized traces.
 *
 * @since 0.2.0
 */
export * from "./dataset.js"

/**
 * Evidence projections extracted from normalized coding traces.
 *
 * @since 0.2.0
 */
export * from "./evidence.js"

/**
 * Execution-backed fixtures, judging, and replay harnesses.
 *
 * @since 0.2.0
 */
export * as Execution from "./execution/index.js"

/**
 * Example-shaping helpers for normalized coding traces.
 *
 * @since 0.2.0
 */
export * from "./example.js"

/**
 * Package-owned implementation-strategy coding surface.
 *
 * @since 0.2.0
 */
export * as ImplementationStrategy from "./implementationStrategy/index.js"

/**
 * Outcome projections derived from normalized coding traces.
 *
 * @since 0.2.0
 */
export * from "./outcome.js"

/**
 * Prompt-surface projections for coding-surface optimization.
 *
 * @since 0.2.0
 */
export * from "./promptSurface.js"

/**
 * Shared coding projection schemas and dataset case shapes.
 *
 * @since 0.2.0
 */
export * from "./schema.js"

/**
 * Task projections derived from normalized coding traces.
 *
 * @since 0.2.0
 */
export * from "./task.js"
