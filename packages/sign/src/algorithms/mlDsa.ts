/**
 * ML-DSA (Module-Lattice Digital Signature Algorithm) post-quantum signatures.
 *
 * Post-quantum signature algorithm standardized as FIPS-204 (formerly
 * known as CRYSTALS-Dilithium). Primary post-quantum signature scheme
 * for long-lived content provenance that must survive quantum computing.
 *
 * Wraps `@noble/post-quantum/ml-dsa` — audited, zero-dependency.
 * Lattice-based construction over Module-LWE (Learning with Errors).
 *
 * Three security levels:
 * - **ML-DSA-44** (NIST Level 2): 1312B pk, 2560B sk, 2420B sig
 * - **ML-DSA-65** (NIST Level 3): 1952B pk, 4032B sk, 3309B sig
 * - **ML-DSA-87** (NIST Level 5): 2592B pk, 4896B sk, 4627B sig
 *
 * ML-DSA-65 is recommended for most applications — it provides
 * 192-bit post-quantum security (NIST Level 3) with moderate key
 * and signature sizes.
 *
 * Security property: EUF-CMA under Module-LWE hardness assumption.
 * Deterministic signing (no random nonce). Signatures are larger
 * than classical (~3.3KB vs 64B for Ed25519) — this is the cost
 * of quantum resistance.
 *
 * @see {@link slhDsa} — alternative post-quantum (hash-based, conservative)
 * @see {@link hybrid} — classical + post-quantum hybrid for transition
 * @see {@link ed25519} — classical alternative (faster, smaller, not quantum-safe)
 *
 * @since 0.1.0
 * @category algorithms
 */
import { ml_dsa44, ml_dsa65, ml_dsa87 } from "@noble/post-quantum/ml-dsa.js"
import { Effect } from "effect"
import { SigningFailed, VerificationFailed } from "../schemas/errors.js"
import { KeyPair } from "../schemas/KeyPair.js"
import { Signature } from "../schemas/Signature.js"

// ---------------------------------------------------------------------------
// ML-DSA-44 (NIST Level 2)
// ---------------------------------------------------------------------------

/**
 * Sign a message with ML-DSA-44.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa44Sign = (
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<Signature, SigningFailed> =>
  Effect.try({
    try: () =>
      new Signature({
        algorithm: "ml-dsa-44",
        signature: ml_dsa44.sign(message, secretKey),
        publicKey
      }),
    catch: (error) => new SigningFailed({ algorithm: "ml-dsa-44", reason: String(error) })
  })

/**
 * Verify an ML-DSA-44 signature against a message and public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa44Verify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, VerificationFailed> =>
  Effect.try({
    try: () => ml_dsa44.verify(signature, message, publicKey),
    catch: (error) => new VerificationFailed({ algorithm: "ml-dsa-44", reason: String(error) })
  })

/**
 * Generate an ML-DSA-44 key pair.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa44Keygen = (): Effect.Effect<KeyPair> =>
  Effect.sync(() => {
    const { secretKey, publicKey } = ml_dsa44.keygen()
    return new KeyPair({ algorithm: "ml-dsa-44", publicKey, secretKey })
  })

// ---------------------------------------------------------------------------
// ML-DSA-65 (NIST Level 3)
// ---------------------------------------------------------------------------

/**
 * Sign a message with ML-DSA-65.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa65Sign = (
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<Signature, SigningFailed> =>
  Effect.try({
    try: () =>
      new Signature({
        algorithm: "ml-dsa-65",
        signature: ml_dsa65.sign(message, secretKey),
        publicKey
      }),
    catch: (error) => new SigningFailed({ algorithm: "ml-dsa-65", reason: String(error) })
  })

/**
 * Verify an ML-DSA-65 signature against a message and public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa65Verify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, VerificationFailed> =>
  Effect.try({
    try: () => ml_dsa65.verify(signature, message, publicKey),
    catch: (error) => new VerificationFailed({ algorithm: "ml-dsa-65", reason: String(error) })
  })

/**
 * Generate an ML-DSA-65 key pair.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa65Keygen = (): Effect.Effect<KeyPair> =>
  Effect.sync(() => {
    const { secretKey, publicKey } = ml_dsa65.keygen()
    return new KeyPair({ algorithm: "ml-dsa-65", publicKey, secretKey })
  })

// ---------------------------------------------------------------------------
// ML-DSA-87 (NIST Level 5)
// ---------------------------------------------------------------------------

/**
 * Sign a message with ML-DSA-87.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa87Sign = (
  message: Uint8Array,
  secretKey: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<Signature, SigningFailed> =>
  Effect.try({
    try: () =>
      new Signature({
        algorithm: "ml-dsa-87",
        signature: ml_dsa87.sign(message, secretKey),
        publicKey
      }),
    catch: (error) => new SigningFailed({ algorithm: "ml-dsa-87", reason: String(error) })
  })

/**
 * Verify an ML-DSA-87 signature against a message and public key.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa87Verify = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Effect.Effect<boolean, VerificationFailed> =>
  Effect.try({
    try: () => ml_dsa87.verify(signature, message, publicKey),
    catch: (error) => new VerificationFailed({ algorithm: "ml-dsa-87", reason: String(error) })
  })

/**
 * Generate an ML-DSA-87 key pair.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const mlDsa87Keygen = (): Effect.Effect<KeyPair> =>
  Effect.sync(() => {
    const { secretKey, publicKey } = ml_dsa87.keygen()
    return new KeyPair({ algorithm: "ml-dsa-87", publicKey, secretKey })
  })
