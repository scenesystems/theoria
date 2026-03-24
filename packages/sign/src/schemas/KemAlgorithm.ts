/**
 * Schema-validated key encapsulation mechanism algorithm literal.
 *
 * `"xwing"` is the hybrid KEM combining X25519 (classical) with
 * ML-KEM-768 (post-quantum, FIPS-203). An attacker must break
 * both X25519 AND ML-KEM to recover the shared secret.
 *
 * @see {@link KemCiphertext} — output of encapsulation
 * @see {@link SignatureAlgorithm} — separate union for signature algorithms
 * @see {@link AgreementAlgorithm} — separate union for agreement algorithms
 *
 * @since 0.1.0
 * @category schemas
 */
import { Schema } from "effect"

/**
 * Supported key encapsulation mechanism algorithms.
 *
 * @since 0.1.0
 * @category schemas
 */
export const KemAlgorithm = Schema.Literal("xwing")
