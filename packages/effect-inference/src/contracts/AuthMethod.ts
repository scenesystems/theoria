/**
 * Authentication-method authority for runtime routes.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Normalized authentication modes across hosted, brokered, and self-hosted
 * runtimes.
 *
 * @since 0.1.0
 * @category schemas
 */
export const AuthMethodSchema = Schema.Literal(
  "none",
  "api-key",
  "bearer-token",
  "hf-token",
  "provider-key",
  "credentials-include"
)

/**
 * Identifies the credential transport a route expects; it describes how a
 * client authenticates and never contains the credential itself.
 *
 * @since 0.1.0
 * @category type-level
 */
export type AuthMethod = Schema.Schema.Type<typeof AuthMethodSchema>
