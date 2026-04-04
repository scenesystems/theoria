/**
 * Execution trace collection via FiberRef — zero contention, fiber-scoped.
 *
 * @since 0.1.0
 */

/**
 * Core `Entry` model and `noScore` constant.
 *
 * @since 0.1.0
 */
export * from "./model.js"

/**
 * FiberRef storage — `TraceRef`, `UsageRef`, and their opt-in markers.
 *
 * @since 0.1.0
 */
export * from "./refs.js"

/**
 * Append combinators — `append`, `appendUsage`, and `appendExecution`.
 *
 * @since 0.1.0
 */
export * from "./append.js"

/**
 * Scoping combinators — `withTracing`, `withUsageTracking`, and `get`.
 *
 * @since 0.1.0
 */
export * from "./scope.js"
