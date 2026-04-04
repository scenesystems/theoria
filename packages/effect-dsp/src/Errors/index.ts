/**
 * Typed error classes for effect-dsp — all errors are `Schema.TaggedError`,
 * yieldable in `Effect.gen`, catchable via `Effect.catchTag`, and
 * Schema-serializable.
 *
 * @since 0.1.0
 */

/**
 * `MetricError` and `EvaluationFailed` — metric scoring and per-example
 * failures.
 *
 * @since 0.1.0
 */
export * from "./metric.js"

/**
 * `ParseOutputError`, `ParseFieldDiagnostic`, and `CompositionError` — LLM
 * output parsing and module composition failures.
 *
 * @since 0.1.0
 */
export * from "./module.js"

/**
 * `BootstrapFailed`, `InstructionProposalFailed`, `AllTrialsFailed`, and
 * `MergeRejected` — optimizer-specific failures.
 *
 * @since 0.1.0
 */
export * from "./optimizer.js"

/**
 * `SaveLoadError` — module parameter persistence failures.
 *
 * @since 0.1.0
 */
export * from "./save-load.js"

/**
 * `SignatureError` — invalid signature definitions.
 *
 * @since 0.1.0
 */
export * from "./signature.js"

/**
 * `TraceError` — trace collection pipeline failures.
 *
 * @since 0.1.0
 */
export * from "./trace.js"

/**
 * `DspError` union schema and type — the complete error vocabulary.
 *
 * @since 0.1.0
 */
export * from "./union.js"
