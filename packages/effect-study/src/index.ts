/**
 * Reusable trial evaluation, history, lifecycle, and artifact persistence.
 * Search algorithms and objective ranking belong to effect-search.
 *
 * @since 0.1.0
 * @module
 */
/** Shared identities, provenance, and envelope schemas. @since 0.1.0 @category modules */
export * as Artifacts from "./Artifacts.js"
/** Evaluation of fixed inputs with typed observations. @since 0.1.0 @category modules */
export * as Evaluation from "./Evaluation.js"
/** Scoped producer-to-stream composition. @since 0.1.0 @category modules */
export * as Events from "./Events.js"
/** Ordered trial history and replacement-aware cost accounting. @since 0.1.0 @category modules */
export * as History from "./History.js"
/** Schema-driven JSON-lines persistence. @since 0.1.0 @category modules */
export * as Journal from "./Journal.js"
/** Valid transitions between study phases. @since 0.1.0 @category modules */
export * as Lifecycle from "./Lifecycle.js"
/** Deterministic cooperative stop controls. @since 0.1.0 @category modules */
export * as Stop from "./Stop.js"
/** Caller-composed trial and outcome schemas. @since 0.1.0 @category modules */
export * as Trial from "./Trial.js"
