/**
 * Classical + post-quantum hybrid algorithms.
 *
 * Hybrid constructions combining classical and post-quantum primitives
 * for the transition period. Provides classical security today (in case
 * PQ algorithms have undiscovered weaknesses) plus quantum resistance
 * for long-lived content addresses.
 *
 * **XWing** (primary hybrid key agreement): combines X25519 (classical)
 * with ML-KEM-768 (post-quantum, FIPS-203/Kyber). Shared secret is
 * derived from both — an attacker must break both X25519 AND ML-KEM
 * to recover the shared secret. Follows the CG Framework for hybrid
 * key encapsulation.
 *
 * Wraps `@noble/post-quantum/ml-kem` for ML-KEM-768 and
 * `@noble/curves/ed25519` for X25519 — both audited, zero-dependency.
 *
 * Hybrid key agreement output:
 * - Combined shared secret: 32 bytes (KDF of X25519 ⊕ ML-KEM)
 * - Encapsulated ciphertext: X25519 public key + ML-KEM ciphertext
 *
 * Use hybrid when:
 * - Content addresses must survive quantum computing
 * - Defense-in-depth against undiscovered PQ algorithm weaknesses
 *
 * @see {@link x25519} — classical key agreement (component of XWing)
 * @see {@link mlDsa} — post-quantum signatures (standalone)
 * @see {@link ed25519} — classical signatures (standalone)
 *
 * @since 0.1.0
 * @category algorithms
 */
import { XWing } from "@noble/post-quantum/hybrid.js"
import { Effect } from "effect"
import { KemFailed } from "../schemas/errors.js"
import { KemCiphertext } from "../schemas/KemCiphertext.js"
import { KeyPair } from "../schemas/KeyPair.js"

/**
 * Encapsulate a shared secret for a recipient's XWing public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const xwingEncapsulate = (
  publicKey: Uint8Array
): Effect.Effect<KemCiphertext, KemFailed> =>
  Effect.try({
    try: () => {
      const result = XWing.encapsulate(publicKey)
      return new KemCiphertext({
        algorithm: "xwing",
        ciphertext: result.cipherText,
        sharedSecret: result.sharedSecret
      })
    },
    catch: (error) => new KemFailed({ algorithm: "xwing", reason: String(error) })
  })

/**
 * Decapsulate a ciphertext with the recipient's XWing secret key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const xwingDecapsulate = (
  cipherText: Uint8Array,
  secretKey: Uint8Array
): Effect.Effect<Uint8Array, KemFailed> =>
  Effect.try({
    try: () => XWing.decapsulate(cipherText, secretKey),
    catch: (error) => new KemFailed({ algorithm: "xwing", reason: String(error) })
  })

/**
 * Generate an XWing key pair.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const xwingKeygen = (): Effect.Effect<KeyPair> =>
  Effect.sync(() => {
    const { secretKey, publicKey } = XWing.keygen()
    return new KeyPair({ algorithm: "xwing", publicKey, secretKey })
  })
