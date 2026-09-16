/**
 * Effect-native signatures, key agreement, encapsulation, and JWT verification.
 * Select a suite explicitly and provide Entropy.layer at the host boundary for
 * key generation and randomized signing. Each namespace also has a public
 * package subpath, for example `@scenesystems/sign/Ed25519`.
 *
 * @since 0.5.0
 * @module
 */

/**
 * Message bytes and length-constant comparison.
 * @since 0.5.0
 * @category bytes
 */
export * as Bytes from "./Bytes.js"

/**
 * Pure Ed25519 signing and strict RFC 8032 verification.
 * @since 0.5.0
 * @category signatures
 */
export * as Ed25519 from "./Ed25519.js"

/**
 * Cryptographic entropy capability and native provider.
 * @since 0.5.0
 * @category services
 */
export * as Entropy from "./Entropy.js"

/**
 * RS256 JWT verification with trusted keys and explicit claim policy.
 * @since 0.4.0
 * @category protocols
 */
export * as Jwt from "./Jwt.js"

/**
 * Caller-owned key-pair representation and generation failures.
 * @since 0.5.0
 * @category models
 */
export * as KeyPair from "./KeyPair.js"

/**
 * FIPS 204 lattice-based signatures.
 * @since 0.5.0
 * @category signatures
 */
export * as MlDsa from "./MlDsa.js"

/**
 * Strict SHA-256, P1363 low-S P-256 verification.
 * @since 0.5.0
 * @category signatures
 */
export * as P256 from "./P256.js"

/**
 * RSA public key admission and RS256 verification.
 * @since 0.5.0
 * @category signatures
 */
export * as Rsa from "./Rsa.js"

/**
 * secp256k1 ECDSA and BIP-340 Schnorr signatures.
 * @since 0.5.0
 * @category signatures
 */
export * as Secp256k1 from "./Secp256k1.js"

/**
 * Algorithm-tagged signature results and signing failures.
 * @since 0.5.0
 * @category models
 */
export * as Signature from "./Signature.js"

/**
 * FIPS 205 stateless hash-based signatures.
 * @since 0.5.0
 * @category signatures
 */
export * as SlhDsa from "./SlhDsa.js"

/**
 * Shared strict-verification policy and material-free failures.
 * @since 0.5.0
 * @category verification
 */
export * as Verification from "./Verification.js"

/**
 * RFC 7748 agreement and raw shared secrets.
 * @since 0.5.0
 * @category agreement
 */
export * as X25519 from "./X25519.js"

/**
 * X25519 and ML-KEM-768 hybrid encapsulation.
 * @since 0.5.0
 * @category encapsulation
 */
export * as XWing from "./XWing.js"
