/**
 * Shared contracts for module identity, parameters, caching, usage,
 * optimizer events, and deterministic projection seams consumed by
 * the optimizer layer and `effect-search` interop.
 *
 * @since 0.1.0
 */

/**
 * Score + optional feedback returned by metric scorers.
 *
 * @since 0.1.0
 */
export * from "./MetricResult.js"

/**
 * Tri-state output rendering strategy (text / structured / auto).
 *
 * @since 0.1.0
 */
export * from "./OutputStrategy.js"

/**
 * Branded kebab-case identifier for module instances.
 *
 * @since 0.1.0
 */
export * from "./ModuleId.js"

/**
 * Literal union of shipped optimizer algorithm identifiers.
 *
 * @since 0.1.0
 */
export * from "./OptimizerKind.js"

/**
 * Composite memoization key for deterministic LM call replay.
 *
 * @since 0.1.0
 */
export * from "./CacheKey.js"

/**
 * Token / call-count accounting and accumulation helpers.
 *
 * @since 0.1.0
 */
export * from "./Usage.js"

/**
 * Uniform envelope for heterogeneous optimizer progress events.
 *
 * @since 0.1.0
 */
export * from "./OptimizerEventEnvelope.js"

/**
 * Re-exported artifact envelope system from `effect-search`.
 *
 * @since 0.1.4
 */
export * from "./ArtifactEnvelope.js"

export {
  /**
   * Typed artifact envelope carrying lineage, payload, and provenance metadata.
   *
   * @since 0.1.0
   * @category type-level
   */
  type ArtifactEnvelope,
  /**
   * Discriminated union of artifact producer origins.
   *
   * @since 0.1.0
   * @category type-level
   */
  type ArtifactProducer,
  /**
   * Typed parent/child relationship between artifacts.
   *
   * @since 0.1.0
   * @category type-level
   */
  type ArtifactRelation,
  /**
   * API contract for artifact sink implementations.
   *
   * @since 0.1.0
   * @category type-level
   */
  type ArtifactSinkApi
} from "./ArtifactEnvelope.js"

/**
 * Recursive JSON-like value type and universal payload record schema.
 *
 * @since 0.1.0
 */
export * from "./FieldValue.js"

/**
 * Learnable parameter bundle (instructions, demos, strategy, knobs).
 *
 * @since 0.1.0
 */
export * from "./ModuleParams.js"

/**
 * Non-generic module-node projection for graph traversal.
 *
 * @since 0.1.0
 */
export * from "./ModuleNode.js"

/**
 * Serializable module composition DAG with deterministic traversal.
 *
 * @since 0.1.0
 */
export * from "./ModuleGraph.js"

/**
 * Typed-to-FieldRecord projection helpers for trace and event emission.
 *
 * @since 0.1.0
 */
export * from "./PayloadProjection.js"

/**
 * Parameter surfaces, search dimensions, and ownership declarations.
 *
 * @since 0.1.0
 */
export * from "./OptimizationSurface.js"

/**
 * Evaluate.Report → effect-search objective projections (scalar + vector).
 *
 * @since 0.1.0
 */
export * from "./ObjectiveProjection.js"

/**
 * Trace.Entry → optimization-ready projection for objective functions.
 *
 * @since 0.1.0
 */
export * from "./TraceProjection.js"
