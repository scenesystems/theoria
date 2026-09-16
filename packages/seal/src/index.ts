/**
 * Effect-native authenticated encryption and JSON-compatible envelopes.
 * Root namespaces and matching `/Cipher` and `/Envelope` imports expose the same declarations.
 *
 * @example
 * ```ts
 * import { Cipher, Envelope } from "@scenesystems/seal"
 * import { Effect, Schema } from "effect"
 *
 * export const program = Effect.gen(function* () {
 *   const key = yield* Cipher.generateKey
 *   const plaintext = yield* Schema.decode(Schema.Uint8Array)([0, 1, 2, 255])
 *   const envelope = yield* Envelope.encrypt("xchacha20-poly1305", key, plaintext)
 *   return yield* Envelope.decrypt(envelope, key)
 * }).pipe(Effect.provide(Cipher.layer))
 * ```
 *
 * @since 0.3.0
 * @module
 */

/**
 * Authenticated-encryption algorithms, failures, operations, and backend service.
 *
 * @since 0.3.0
 * @category modules
 */
export * as Cipher from "./Cipher.js"

/**
 * JSON-compatible ciphertext, conversions, and envelope encryption/decryption.
 *
 * @since 0.3.0
 * @category modules
 */
export * as Envelope from "./Envelope.js"
