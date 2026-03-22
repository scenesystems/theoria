/**
 * @scenesystems/digest — pure core entrypoint.
 *
 * Cryptographic content hashing and canonicalization with zero Effect
 * dependency. Only `@noble/hashes` is required at runtime.
 *
 * Two algorithms: BLAKE3-256 (primary) and SHA-256 (secondary).
 * One canonicalization strategy: RFC 8785 JCS.
 * One encoding: base64url (43 chars, no padding).
 *
 * @example
 * ```ts
 * import { blake3, sha256, canonicalize, digest } from "@scenesystems/digest"
 *
 * const hash = blake3(canonicalize({ key: "value" }))
 * const tagged = digest("blake3-256", canonicalize({ key: "value" }))
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
 * @category contracts
 */
export * from "./contracts.js"
