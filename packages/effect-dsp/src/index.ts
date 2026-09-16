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
export * as Signature from "./Signature.js"

/**
 * Constructs executable model programs and exposes their learnable parameter state.
 *
 * @since 0.1.0
 * @category modules
 */
export * as Module from "./Module.js"

/** Destination-validated demonstration values and codecs.
 * @since 0.5.0
 * @category demonstrations
 */
export * as Demonstration from "./Demonstration.js"
/** Serializable module topology and traversal.
 * @since 0.5.0
 * @category modules
 */
export * as ModuleGraph from "./ModuleGraph.js"
/** Learnable module state and immutable updates.
 * @since 0.5.0
 * @category modules
 */
export * as ModuleParameters from "./ModuleParameters.js"

/**
 * Scores predictions with effectful or synchronous metrics and composes their results.
 *
 * @since 0.1.0
 * @category metrics
 */
export * as Metric from "./Metric.js"

/**
 * Evaluates modules over labeled datasets and emits per-example lifecycle events.
 *
 * @since 0.1.0
 * @category evaluation
 */
export * as Evaluate from "./Evaluate.js"

/** Converts evaluation reports into search objectives.
 * @since 0.5.0
 * @category evaluation
 */
export * as EvaluationObjective from "./EvaluationObjective.js"

/**
 * Models input-only and labeled rows used by evaluation and optimization.
 *
 * @since 0.1.0
 * @category models
 */
export * as Example from "./Example.js"

/**
 * Collects module-call records and usage totals in fiber-local scopes.
 *
 * @since 0.1.0
 * @category tracing
 */
export * as Trace from "./Trace.js"

/**
 * Describes the tagged failures returned by DSP operations.
 *
 * @since 0.1.0
 * @category errors
 */
export * as DspError from "./DspError.js"

/**
 * Memoizes model results with optional rollout-specific cache partitions.
 *
 * @since 0.1.0
 * @category cache
 */
export * as Cache from "./Cache.js"

/** Learns demonstrations from successful scored traces.
 * @since 0.5.0
 * @category optimizers
 */
export * as BootstrapFewShot from "./BootstrapFewShot.js"
/** Searches seeded bootstrap parameter snapshots.
 * @since 0.5.0
 * @category optimizers
 */
export * as BootstrapRS from "./BootstrapRS.js"
/** Constructs a program subset and reduces its outputs.
 * @since 0.5.0
 * @category modules
 */
export * as Ensemble from "./Ensemble.js"
/** Evolves instructions through reflection and Pareto selection.
 * @since 0.5.0
 * @category optimizers
 */
export * as GEPA from "./GEPA.js"
/** Samples labeled examples as demonstrations.
 * @since 0.5.0
 * @category optimizers
 */
export * as LabeledFewShot from "./LabeledFewShot.js"
/** Orchestrates candidate construction and instruction search.
 * @since 0.5.0
 * @category optimizers
 */
export * as MIPROv2 from "./MIPROv2.js"
/** Constructs and validates predictor-bound search candidates.
 * @since 0.5.0
 * @category optimizers
 */
export * as MIPROv2Candidates from "./MIPROv2Candidates.js"
/** Searches prebuilt instruction and demonstration candidates.
 * @since 0.5.0
 * @category optimizers
 */
export * as MIPROv2Search from "./MIPROv2Search.js"
/** Encodes algorithm lifecycle events in portable envelopes.
 * @since 0.5.0
 * @category events
 */
export * as OptimizerEvent from "./OptimizerEvent.js"
/** Serializes schema-owned values without lossy JSON conversion.
 * @since 0.5.0
 * @category encoding
 */
export * as Payload from "./Payload.js"
/** Deterministic native language-model layers for behavioral tests.
 * @since 0.5.0
 * @category testing
 */
export * as MockLanguageModel from "./MockLanguageModel.js"
