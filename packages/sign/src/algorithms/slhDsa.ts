/**
 * SLH-DSA (Stateless Hash-Based Digital Signature Algorithm) post-quantum signatures.
 *
 * Conservative post-quantum signature algorithm standardized as
 * FIPS-205 (formerly known as SPHINCS+). Hash-based construction
 * — security relies only on hash function properties, not lattice
 * assumptions. The most conservative post-quantum choice.
 *
 * Wraps `@noble/post-quantum/slh-dsa` — audited, zero-dependency.
 * Merkle-tree based with FORS (Forest of Random Subsets) few-time
 * signature scheme.
 *
 * Parameter sets (f = fast verification, s = small signatures):
 * - **SLH-DSA-SHA2-128f**: 32B pk, 64B sk, 17088B sig (NIST Level 1)
 * - **SLH-DSA-SHA2-128s**: 32B pk, 64B sk, 7856B sig (NIST Level 1)
 * - **SLH-DSA-SHA2-192f**: 48B pk, 96B sk, 35664B sig (NIST Level 3)
 * - **SLH-DSA-SHA2-256f**: 64B pk, 128B sk, 49856B sig (NIST Level 5)
 *
 * Signatures are significantly larger than ML-DSA (~17KB vs ~3.3KB
 * for Level 1/3), but security assumptions are more conservative —
 * hash functions are better understood than lattice problems.
 *
 * Use SLH-DSA when:
 * - Maximum conservatism is required (hash-only security assumption)
 * - Content must remain verifiable for decades
 * - Signature size is not a critical constraint
 *
 * Security property: EUF-CMA under hash function security (PRF, SPR).
 * Stateless — no counter or state management required.
 *
 * @see {@link mlDsa} — alternative post-quantum (lattice-based, smaller sigs)
 * @see {@link hybrid} — classical + post-quantum hybrid for transition
 *
 * @since 0.1.0
 * @category algorithms
 */
import {
  slh_dsa_sha2_128f,
  slh_dsa_sha2_128s,
  slh_dsa_sha2_192f,
  slh_dsa_sha2_256f
} from "@noble/post-quantum/slh-dsa.js"
import { Effect } from "effect"
import { SigningFailed, VerificationFailed } from "../schemas/errors.js"
import { KeyPair } from "../schemas/KeyPair.js"
import { Signature } from "../schemas/Signature.js"

// ---------------------------------------------------------------------------
// SLH-DSA-SHA2-128f
// ---------------------------------------------------------------------------

/**
 * Sign a message with SLH-DSA-SHA2-128f.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2128fSign = (
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<Signature, SigningFailed> =>
  Effect.try({
    try: () =>
      new Signature({
        algorithm: "slh-dsa-sha2-128f",
        signature: slh_dsa_sha2_128f.sign(message, secretKey),
        publicKey
      }),
    catch: (error) => new SigningFailed({ algorithm: "slh-dsa-sha2-128f", reason: String(error) })
  })

/**
 * Verify an SLH-DSA-SHA2-128f signature against a message and public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2128fVerify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, VerificationFailed> =>
  Effect.try({
    try: () => slh_dsa_sha2_128f.verify(signature, message, publicKey),
    catch: (error) => new VerificationFailed({ algorithm: "slh-dsa-sha2-128f", reason: String(error) })
  })

/**
 * Generate an SLH-DSA-SHA2-128f key pair.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2128fKeygen = (): Effect.Effect<KeyPair> =>
  Effect.sync(() => {
    const { secretKey, publicKey } = slh_dsa_sha2_128f.keygen()
    return new KeyPair({ algorithm: "slh-dsa-sha2-128f", publicKey, secretKey })
  })

// ---------------------------------------------------------------------------
// SLH-DSA-SHA2-128s
// ---------------------------------------------------------------------------

/**
 * Sign a message with SLH-DSA-SHA2-128s.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2128sSign = (
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<Signature, SigningFailed> =>
  Effect.try({
    try: () =>
      new Signature({
        algorithm: "slh-dsa-sha2-128s",
        signature: slh_dsa_sha2_128s.sign(message, secretKey),
        publicKey
      }),
    catch: (error) => new SigningFailed({ algorithm: "slh-dsa-sha2-128s", reason: String(error) })
  })

/**
 * Verify an SLH-DSA-SHA2-128s signature against a message and public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2128sVerify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, VerificationFailed> =>
  Effect.try({
    try: () => slh_dsa_sha2_128s.verify(signature, message, publicKey),
    catch: (error) => new VerificationFailed({ algorithm: "slh-dsa-sha2-128s", reason: String(error) })
  })

/**
 * Generate an SLH-DSA-SHA2-128s key pair.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2128sKeygen = (): Effect.Effect<KeyPair> =>
  Effect.sync(() => {
    const { secretKey, publicKey } = slh_dsa_sha2_128s.keygen()
    return new KeyPair({ algorithm: "slh-dsa-sha2-128s", publicKey, secretKey })
  })

// ---------------------------------------------------------------------------
// SLH-DSA-SHA2-192f
// ---------------------------------------------------------------------------

/**
 * Sign a message with SLH-DSA-SHA2-192f.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2192fSign = (
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<Signature, SigningFailed> =>
  Effect.try({
    try: () =>
      new Signature({
        algorithm: "slh-dsa-sha2-192f",
        signature: slh_dsa_sha2_192f.sign(message, secretKey),
        publicKey
      }),
    catch: (error) => new SigningFailed({ algorithm: "slh-dsa-sha2-192f", reason: String(error) })
  })

/**
 * Verify an SLH-DSA-SHA2-192f signature against a message and public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2192fVerify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, VerificationFailed> =>
  Effect.try({
    try: () => slh_dsa_sha2_192f.verify(signature, message, publicKey),
    catch: (error) => new VerificationFailed({ algorithm: "slh-dsa-sha2-192f", reason: String(error) })
  })

/**
 * Generate an SLH-DSA-SHA2-192f key pair.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2192fKeygen = (): Effect.Effect<KeyPair> =>
  Effect.sync(() => {
    const { secretKey, publicKey } = slh_dsa_sha2_192f.keygen()
    return new KeyPair({ algorithm: "slh-dsa-sha2-192f", publicKey, secretKey })
  })

// ---------------------------------------------------------------------------
// SLH-DSA-SHA2-256f
// ---------------------------------------------------------------------------

/**
 * Sign a message with SLH-DSA-SHA2-256f.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2256fSign = (
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<Signature, SigningFailed> =>
  Effect.try({
    try: () =>
      new Signature({
        algorithm: "slh-dsa-sha2-256f",
        signature: slh_dsa_sha2_256f.sign(message, secretKey),
        publicKey
      }),
    catch: (error) => new SigningFailed({ algorithm: "slh-dsa-sha2-256f", reason: String(error) })
  })

/**
 * Verify an SLH-DSA-SHA2-256f signature against a message and public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2256fVerify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, VerificationFailed> =>
  Effect.try({
    try: () => slh_dsa_sha2_256f.verify(signature, message, publicKey),
    catch: (error) => new VerificationFailed({ algorithm: "slh-dsa-sha2-256f", reason: String(error) })
  })

/**
 * Generate an SLH-DSA-SHA2-256f key pair.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const slhDsaSha2256fKeygen = (): Effect.Effect<KeyPair> =>
  Effect.sync(() => {
    const { secretKey, publicKey } = slh_dsa_sha2_256f.keygen()
    return new KeyPair({ algorithm: "slh-dsa-sha2-256f", publicKey, secretKey })
  })
