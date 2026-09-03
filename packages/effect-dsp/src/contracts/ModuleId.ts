/**
 * Branded module identifier used across runtime, cache keys, and optimizer state.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Validates and brands identities used by module graphs and optimizer state.
 *
 * @remarks
 * Accepted strings start with a lowercase ASCII letter and continue with
 * lowercase letters, digits, or hyphens. The pattern does not reject repeated
 * or trailing hyphens.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ModuleId = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]*$/),
  Schema.brand("ModuleId")
)

/**
 * Selects a string decoded and branded by the {@link ModuleId} schema.
 * @since 0.1.0
 * @category type-level
 */
export type ModuleId = Schema.Schema.Type<typeof ModuleId>
