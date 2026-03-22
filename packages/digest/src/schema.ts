/**
 * @scenesystems/digest/schema — Effect Schema entrypoint.
 *
 * Schema-typed digest operations for Effect programs. Provides
 * `durableFingerprint` for cache-key identity, typed `Digest256`
 * and `ContentDigest` schemas, and canonicalization pipelines
 * that operate on Schema-encoded wire forms.
 *
 * Requires `effect` as a peer dependency.
 *
 * @example
 * ```ts
 * import { durableFingerprint, Digest256, ContentDigest } from "@scenesystems/digest/schema"
 * import { Effect, Schema } from "effect"
 *
 * const key = durableFingerprint({ question: "What is 2+2?" })
 * // => Effect<string, FingerprintUnsupportedValue>
 * ```
 *
 * @since 0.1.0
 * @module
 */

/**
 * @since 0.1.0
 * @category schemas
 */
export * from "./schema/Digest256.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export * from "./schema/ContentDigest.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export * from "./schema/DigestAlgorithm.js"

/**
 * @since 0.1.0
 * @category fingerprint
 */
export * from "./schema/durableFingerprint.js"

/**
 * @since 0.1.0
 * @category errors
 */
export * from "./schema/errors.js"
