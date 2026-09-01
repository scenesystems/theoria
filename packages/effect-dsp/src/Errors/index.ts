/**
 * Classifies failures from signature validation, model parsing and
 * composition, evaluation, optimization, tracing, and parameter persistence.
 *
 * @remarks
 * Recover from a known tagged variant with `Effect.catchTag`. Use
 * {@link DspError} when a serialization boundary needs the complete
 * package-owned error union.
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
