/**
 * Key agreement pipeline.
 *
 * Derives shared secrets using elliptic-curve Diffie–Hellman key
 * agreement. Supports X25519 (RFC 7748).
 *
 * ```
 * Party A's secret key + Party B's public key
 *   → algorithm dispatch (X25519)
 *   → 32-byte shared secret
 * ```
 *
 * The shared secret should be passed through a KDF (e.g., HKDF-SHA256
 * or BLAKE3 derive-key mode) before use as a symmetric encryption key.
 *
 * @see {@link x25519} — the underlying key agreement algorithm
 * @see {@link kem} — key encapsulation mechanism (XWing hybrid)
 * @see {@link sign} — digital signature pipeline
 *
 * @since 0.1.0
 * @category agreement
 */
import type { Effect } from "effect"
import { Match } from "effect"
import { x25519SharedSecret } from "./algorithms/x25519.js"
import type { AgreementAlgorithm } from "./schemas/AgreementAlgorithm.js"
import type { AgreementFailed } from "./schemas/errors.js"
import type { SharedSecret } from "./schemas/SharedSecret.js"

type AgreementAlgorithmType = typeof AgreementAlgorithm.Type

/**
 * Derive a shared secret via key agreement.
 *
 * @since 0.1.0
 * @category agreement
 */
export const deriveSharedSecret = (
  algorithm: AgreementAlgorithmType,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<SharedSecret, AgreementFailed> =>
  Match.value(algorithm).pipe(
    Match.when("x25519", () => x25519SharedSecret(secretKey, publicKey)),
    Match.exhaustive
  )
