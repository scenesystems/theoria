/**
 * Captures the modules that execute inside a concurrent discovery scope.
 *
 * Predictors and composites register their identities and live parameter refs
 * before execution. Discovery combinators install an isolated synchronized
 * collector shared by child fibers and return a stable point-in-time snapshot
 * or project it into a `ModuleGraph`.
 *
 * @since 0.1.0
 * @module
 */

export * from "./model.js"

export * from "./registry.js"

export * from "./collect.js"
