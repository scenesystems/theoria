/**
 * Collects module-call records and token usage in fiber-local scopes.
 *
 * @remarks
 * Collection is disabled unless a scope combinator enables it. Child fibers
 * inherit the active references according to Effect `FiberRef` semantics.
 *
 * @since 0.1.0
 * @module
 */

export * from "./model.js"

export * from "./refs.js"

export * from "./append.js"

export * from "./scope.js"
