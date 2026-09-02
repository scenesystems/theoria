/**
 * Credential transport identifiers stored in execution routes.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

/**
 * Accepts the credential transports understood by inference route adapters.
 * Values identify a mechanism and never contain the credential.
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
 * Identifies how a client authenticates to an inference route.
 *
 * @since 0.1.0
 * @category type-level
 */
export type AuthMethod = Schema.Schema.Type<typeof AuthMethodSchema>
