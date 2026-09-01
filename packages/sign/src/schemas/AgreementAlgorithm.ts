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
 * Runtime schema and type authority for the sole agreement tag, `"x25519"`;
 * signature and KEM tags are deliberately not admitted.
 *
 * @since 0.1.0
 * @category schemas
 */
export const AgreementAlgorithm = Schema.Literal("x25519")
