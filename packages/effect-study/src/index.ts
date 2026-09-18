/**
 * Reusable trial evaluation, history, lifecycle, and artifact persistence.
 * Search algorithms and objective ranking belong to effect-search.
 *
 * @since 0.1.0
 * @module
 */
/** Shared identities, provenance, and envelope schemas. @since 0.1.0 @category modules */
export * as Artifact from "./Artifact.js"
/** Run-scoped artifact identity allocation. @since 0.1.0 @category modules */
export * as ArtifactContext from "./ArtifactContext.js"
/** Schema-owned artifact delivery and persistence. @since 0.1.0 @category modules */
export * as ArtifactSink from "./ArtifactSink.js"
/** Scoped producer-to-stream composition. @since 0.1.0 @category modules */
export * as Emitter from "./Emitter.js"
/** Evaluation of fixed inputs with typed observations. @since 0.1.0 @category modules */
export * as Evaluation from "./Evaluation.js"
/** Ordered trial history and replacement-aware cost accounting. @since 0.1.0 @category modules */
export * as History from "./History.js"
/** Schema-driven JSON-lines persistence. @since 0.1.0 @category modules */
export * as Journal from "./Journal.js"
/** Valid transitions between study phases. @since 0.1.0 @category modules */
export * as Lifecycle from "./Lifecycle.js"
/** Deterministic cooperative stop controls. @since 0.1.0 @category modules */
export * as Stop from "./Stop.js"
/** Scoped lifecycle and transactional trial history. @since 0.1.0 @category modules */
export * as Study from "./Study.js"
/** Caller-composed study event schemas. @since 0.1.0 @category modules */
export * as StudyEvent from "./StudyEvent.js"
/** Schema-parametric trial and snapshot journals. @since 0.1.0 @category modules */
export * as StudyStorage from "./StudyStorage.js"
/** Caller-composed trial and outcome schemas. @since 0.1.0 @category modules */
export * as Trial from "./Trial.js"
