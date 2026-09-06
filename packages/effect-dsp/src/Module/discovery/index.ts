/**
 * Captures the modules that execute inside a fiber-local scope.
 *
 * Predictors and composites register their identities and live parameter refs
 * before execution. Discovery combinators isolate that registry and return a
 * stable snapshot or project it into a `ModuleGraph`.
 *
 * @since 0.1.0
 * @module
 */

export * from "./model.js"

export * from "./registry.js"

export * from "./collect.js"
