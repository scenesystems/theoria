/**
 * Schema-validated seal algorithm literal.
 *
 * Three AEAD algorithms are supported — XChaCha20-Poly1305 as the
 * recommended default, AES-256-GCM-SIV as the nonce-misuse resistant
 * alternative, and AES-256-GCM for external compatibility.
 *
 * The literal values match the IANA-style algorithm identifiers
 * used by `@noble/ciphers` and are the canonical algorithm names
 * throughout the Theoria ecosystem.
 *
 * @see {@link SealedEnvelope} — uses this as the algorithm field
 * @see {@link xchacha20Encrypt} — recommended default algorithm
 * @see {@link aesgcmsivEncrypt} — nonce-misuse resistant alternative
 * @see {@link aesgcmEncrypt} — compatibility alternative
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"

/**
 * Supported authenticated encryption algorithms.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SealAlgorithm = Schema.Literal(
  "xchacha20-poly1305",
  "aes-256-gcm-siv",
  "aes-256-gcm"
)
