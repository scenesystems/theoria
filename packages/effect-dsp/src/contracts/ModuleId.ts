/**
 * Branded module identifier used across runtime, cache keys, and optimizer state.
 *
 * @since 0.0.0
 */
import { Schema } from "effect"

/**
 * Branded schema for module instance identity. Accepts lowercase
 * kebab-case strings (`^[a-z][a-z0-9-]*$`) — matching the naming
 * convention used by `Module.make` to register predictors and
 * composed pipelines.
 *
 * @see {@link CacheKey} — uses ModuleId as part of the memoization key
 * @see {@link ModuleNode} — carries ModuleId for graph traversal
 *
 * @since 0.0.0
 * @category schemas
 */
export const ModuleId = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]*$/),
  Schema.brand("ModuleId")
)

/**
 * Inferred runtime type of {@link ModuleId}.
 *
 * @see {@link ModuleId}
 * @since 0.0.0
 * @category type-level
 */
export type ModuleId = Schema.Schema.Type<typeof ModuleId>
