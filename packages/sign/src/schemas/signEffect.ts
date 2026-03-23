/**
 * Effect-wrapped sign, verify, and key generation operations.
 *
 * Lifts the pure core layer operations into Effect with typed errors.
 * All operations return `Effect<A, E>` where E is a union of
 * the typed errors from {@link errors}.
 *
 * **`signEffect`** — sign a message with a secret key:
 * ```ts
 * const signEffect: (
 *   algorithm: SignatureAlgorithm,
 *   message: Uint8Array,
 *   secretKey: Uint8Array
 * ) => Effect<Signature, SigningFailed>
 * ```
 *
 * **`verifyEffect`** — verify a signature against a message:
 * ```ts
 * const verifyEffect: (
 *   signature: Signature,
 *   message: Uint8Array
 * ) => Effect<boolean, VerificationFailed | InvalidSignature>
 * ```
 *
 * **`generateKeyPairEffect`** — generate a key pair for any family:
 * ```ts
 * const generateKeyPairEffect: (
 *   algorithm: SignatureAlgorithm | AgreementAlgorithm | KemAlgorithm
 * ) => Effect<KeyPair, KeyGenerationFailed>
 * ```
 *
 * @see {@link sign} in core — the pure functions these wrap
 * @see {@link Signature} — return type of signEffect
 * @see {@link KeyPair} — return type of generateKeyPairEffect
 *
 * @since 0.1.0
 * @category operations
 */
