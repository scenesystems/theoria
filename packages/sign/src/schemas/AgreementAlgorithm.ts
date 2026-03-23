/**
 * Schema-validated key agreement algorithm literal.
 *
 * `"x25519"` is the only classical key agreement algorithm.
 * X25519 provides 128-bit classical security via ECDH on
 * Curve25519 (RFC 7748).
 *
 * @see {@link SharedSecret} — output of key agreement
 * @see {@link SignatureAlgorithm} — separate union for signature algorithms
 * @see {@link KemAlgorithm} — separate union for KEM algorithms
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"

/**
 * Supported key agreement algorithms.
 *
 * @since 0.1.0
 * @category schemas
 */
export const AgreementAlgorithm = Schema.Literal("x25519")
