/**
 * Collects successful entries, invocation calls, and canonical token usage.
 *
 * @remarks
 * Collection is disabled unless a lexical scope combinator enables it. Nested
 * scopes own their snapshots while forwarding each event once to ancestors.
 *
 * @since 0.1.0
 * @module
 */

export * from "./model.js"

export * from "./append.js"

export { observeUsage } from "./call.js"

export * from "./scope.js"
