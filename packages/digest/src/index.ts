/**
 * Strict content hashing and RFC 8785 canonicalization for Effect programs.
 *
 * @remarks
 * Hashing functions accept bytes; text helpers reject unpaired UTF-16
 * surrogates rather than replacing them. Structured-value helpers admit only
 * the package's documented plain-data domain and report closed errors through
 * the Effect error channel.
 *
 * @see {@link blake3Hash}
 * @see {@link sha256}
 * @see {@link canonicalize}
 * @see {@link toBase64Url}
 * @see {@link durableFingerprint}
 * @see {@link Digest256}
 * @see {@link ContentDigest}
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
 * @category digest
 */
export * from "./convenience.js"

/**
 * @since 0.1.0
 * @category digest
 */
export * from "./digestSchemaValue.js"

/**
 * @since 0.2.0
 * @category digest
 */
export * from "./streaming.js"

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
