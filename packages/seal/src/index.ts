/**
 * @scenesystems/seal — authenticated encryption for Effect.
 *
 * Three AEAD algorithms are supported — see each algorithm module
 * for security properties, nonce sizes, and trade-offs.
 *
 * @see {@link xchacha20} — recommended default
 * @see {@link aesgcmsiv} — nonce-misuse resistant alternative
 * @see {@link aesgcm} — compatibility alternative
 * @see {@link sealEffect} — Effect-wrapped encrypt/decrypt
 * @see {@link SealedEnvelope} — encrypted payload schema
 * @see {@link SealAlgorithm} — algorithm literal union
 *
 * @example
 * ```ts
 * import { sealEffect, SealedEnvelope } from "@scenesystems/seal"
 * import { Effect } from "effect"
 *
 * const encrypted = sealEffect.encrypt("xchacha20-poly1305", key, data)
 * // Effect<SealedEnvelope, InvalidKey>
 *
 * const decrypted = sealEffect.decrypt(key, envelope)
 * // Effect<Uint8Array, DecryptionFailed | InvalidKey>
 * ```
 *
 * @since 0.1.0
 * @module
 */

/**
 * @since 0.1.0
 * @category algorithms
 */
export * from "./algorithms/xchacha20.js"

/**
 * @since 0.1.0
 * @category algorithms
 */
export * from "./algorithms/aesgcmsiv.js"

/**
 * @since 0.1.0
 * @category algorithms
 */
export * from "./algorithms/aesgcm.js"

/**
 * @since 0.1.0
 * @category seal
 */
export * from "./seal.js"

/**
 * @since 0.1.0
 * @category encoding
 */
export * from "./encoding.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export * from "./schemas/SealAlgorithm.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export * from "./schemas/SealedEnvelope.js"

/**
 * @since 0.1.0
 * @category errors
 */
export * from "./schemas/errors.js"

/**
 * @since 0.1.0
 * @category seal
 */
export * from "./schemas/sealEffect.js"

/**
 * @since 0.1.0
 * @category encoding
 */
export * from "./utf8.js"
