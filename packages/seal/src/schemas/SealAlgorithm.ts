/**
 * Schema for the algorithm identifiers accepted by {@link seal}.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"

/**
 * Accepts `"xchacha20-poly1305"`, `"aes-256-gcm-siv"`, or `"aes-256-gcm"`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SealAlgorithm = Schema.Literal(
  "xchacha20-poly1305",
  "aes-256-gcm-siv",
  "aes-256-gcm"
)
