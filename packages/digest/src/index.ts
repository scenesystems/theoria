/**
 * Effect-native content identity, canonical JSON, strict Unicode, hashing,
 * message authentication, and key derivation. Each concern is also available
 * through its matching package subpath. Private kernels are not public APIs.
 *
 * @since 0.7.0
 * @module
 */

/**
 * BLAKE3 keyed authentication and context-separated derivation.
 * @since 0.7.0
 * @category modules
 */
export * as Blake3 from "./Blake3.js"

/**
 * RFC 8785 canonical JSON admission and encoding.
 * @since 0.7.0
 * @category modules
 */
export * as CanonicalJson from "./CanonicalJson.js"

/**
 * Algorithm-tagged content identities and Schema-defined preimages.
 * @since 0.7.0
 * @category modules
 */
export * as ContentDigest from "./ContentDigest.js"

/**
 * Raw byte, strict text, and streaming cryptographic hashes.
 * @since 0.7.0
 * @category modules
 */
export * as Digest from "./Digest.js"

/**
 * RFC 5869 extract-and-expand key derivation.
 * @since 0.7.0
 * @category modules
 */
export * as Hkdf from "./Hkdf.js"

/**
 * RFC 2104 message authentication codes.
 * @since 0.7.0
 * @category modules
 */
export * as Hmac from "./Hmac.js"

/**
 * Strict UTF-8 encoding and Unicode scalar construction.
 * @since 0.7.0
 * @category modules
 */
export * as Utf8 from "./Utf8.js"
