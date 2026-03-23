/**
 * @scenesystems/seal — authenticated encryption for Effect.
 *
 * Three AEAD algorithms are supported — see each algorithm module
 * for security properties, nonce sizes, and trade-offs.
 *
 * @see {@link xchacha20} — recommended default
 * @see {@link aesgcmsiv} — nonce-misuse resistant alternative
 * @see {@link aesgcm} — compatibility alternative
 * @see {@link seal} — encrypt pipeline
 * @see {@link unseal} — decrypt pipeline
 * @see {@link SealedEnvelope} — encrypted payload schema
 * @see {@link SealAlgorithm} — algorithm literal union
 *
 * @example
 * ```ts
 * import { generateKey, seal, unseal, utf8ToBytes } from "@scenesystems/seal"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const key = yield* generateKey()
 *   const plaintext = utf8ToBytes("hello, world")
 *   const envelope = yield* seal("xchacha20-poly1305", key, plaintext)
 *   const recovered = yield* unseal(key, envelope)
 *   return recovered
 * })
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
 * @category encoding
 */
export * from "./utf8.js"
