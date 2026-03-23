/**
 * @scenesystems/digest — cryptographic content hashing and
 * canonicalization for Effect.
 *
 * Two algorithms, one canonicalization strategy, one encoding. BLAKE3
 * context mode provides native domain separation — no manual salt
 * concatenation needed.
 *
 * @see {@link blake3Hash} — primary hash algorithm
 * @see {@link sha256} — secondary hash algorithm
 * @see {@link canonicalize} — RFC 8785 JCS canonicalization
 * @see {@link toBase64Url} — base64url encoding
 * @see {@link durableFingerprint} — canonical fingerprinting function
 * @see {@link Digest256} — branded digest value schema
 * @see {@link ContentDigest} — algorithm-tagged digest pair
 *
 * @example
 * ```ts
 * import { blake3Hash, canonicalize, digest, durableFingerprint } from "@scenesystems/digest"
 * import { Effect } from "effect"
 *
 * const hash = blake3Hash(canonicalize({ key: "value" }))
 * const tagged = digest("blake3-256", { key: "value" })
 * const key = durableFingerprint({ question: "What is 2+2?" })
 * // Effect<string, FingerprintUnsupportedValue>
 * ```
 *
 * @since 0.1.0
 * @module
 */

/**
 * @since 0.1.0
 * @category algorithms
 */
export * from "./algorithms/blake3.js"

/**
 * @since 0.1.0
 * @category algorithms
 */
export * from "./algorithms/sha256.js"

/**
 * @since 0.1.0
 * @category canonicalization
 */
export * from "./canonicalize.js"

/**
 * @since 0.1.0
 * @category encoding
 */
export * from "./encoding.js"

/**
 * @since 0.1.0
 * @category digest
 */
export * from "./digest.js"

/**
 * @since 0.1.0
 * @category authentication
 */
export * from "./hmac.js"

/**
 * @since 0.1.0
 * @category key-derivation
 */
export * from "./kdf.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export * from "./schemas/Digest256.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export * from "./schemas/ContentDigest.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export * from "./schemas/DigestAlgorithm.js"

/**
 * @since 0.1.0
 * @category fingerprint
 */
export * from "./schemas/durableFingerprint.js"

/**
 * @since 0.1.0
 * @category errors
 */
export * from "./schemas/errors.js"
