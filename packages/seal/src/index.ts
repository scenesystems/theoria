/**
 * Effect operations for authenticated encryption, envelope encoding, and byte utilities.
 *
 * @remarks
 * Use {@link seal} and {@link unseal} when storing a self-describing
 * {@link SealedEnvelope}. The direct algorithm operations instead exchange nonce-prefixed bytes.
 *
 * @example
 * ```ts
 * import { generateKey, seal, unseal, utf8FromBytes, utf8ToBytes } from "@scenesystems/seal"
 * import { Effect } from "effect"
 *
 * export const program = Effect.gen(function* () {
 *   const key = yield* generateKey()
 *   const plaintext = utf8ToBytes("hello, world")
 *   const envelope = yield* seal("xchacha20-poly1305", key, plaintext)
 *   const recovered = yield* unseal(key, envelope)
 *   return yield* Effect.succeed(utf8FromBytes(recovered)).pipe(
 *     Effect.filterOrFail(
 *       (text) => text === "hello, world",
 *       () => "PlaintextDidNotRoundTrip"
 *     )
 *   )
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
