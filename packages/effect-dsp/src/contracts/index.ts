/**
 * Defines the portable records exchanged by modules, evaluators, optimizers, and storage.
 *
 * @remarks
 * Contracts in this entry point avoid live language-model or module services.
 * Projection functions convert runtime records into schema-validated payloads
 * for tracing, objective evaluation, artifact publication, and effect-search interop.
 *
 * @since 0.1.0
 */

export * from "./MetricResult.js"

export * from "./OutputStrategy.js"

export * from "./ModuleId.js"

export * from "./OptimizerKind.js"

export * from "./CacheKey.js"

export * from "./Usage.js"

export * from "./OptimizerEventEnvelope.js"

export * from "./ArtifactEnvelope.js"

export {
  type ArtifactEnvelope,
  type ArtifactProducer,
  type ArtifactRelation,
  type ArtifactSinkApi
} from "./ArtifactEnvelope.js"

export * from "./FieldValue.js"

export * from "./ModuleParams.js"

export * from "./ModuleNode.js"

export * from "./ModuleGraph.js"

export * from "./PayloadProjection.js"

export * from "./OptimizationSurface.js"

export * from "./ObjectiveProjection.js"

export * from "./TraceProjection.js"
