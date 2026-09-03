/**
 * Defines the cipher discriminator stored in a {@link SealedEnvelope}.
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"

/**
 * Selects cipher dispatch and the nonce length used by envelope encoding.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SealAlgorithm = Schema.Literal(
  "xchacha20-poly1305",
  "aes-256-gcm-siv",
  "aes-256-gcm"
)
