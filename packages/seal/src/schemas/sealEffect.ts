/**
 * Effect-wrapped encrypt/decrypt operations.
 *
 * Wraps the core {@link seal} and {@link unseal} functions with
 * Effect error channels for typed error handling in Effect programs.
 *
 * **`sealEffect.encrypt`** — encrypts plaintext with algorithm
 * selection, returning `Effect<SealedEnvelope, InvalidKey>`.
 * Key validation is performed before cipher invocation.
 *
 * **`sealEffect.decrypt`** — decrypts a `SealedEnvelope`, returning
 * `Effect<Uint8Array, DecryptionFailed | InvalidKey>`. The algorithm
 * is read from the envelope's `algorithm` field.
 *
 * Both operations are synchronous under the hood (no async crypto)
 * but are lifted into Effect for composability with Effect
 * pipelines and typed error propagation.
 *
 * @example
 * ```ts
 * import { sealEffect } from "@scenesystems/seal"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const envelope = yield* sealEffect.encrypt(
 *     "xchacha20-poly1305",
 *     key,
 *     plaintext
 *   )
 *   const recovered = yield* sealEffect.decrypt(key, envelope)
 *   return recovered
 * })
 * ```
 *
 * @see {@link seal} in seal.ts — encrypt/decrypt pipeline
 * @see {@link DecryptionFailed} — decryption error type
 * @see {@link InvalidKey} — key validation error type
 * @see {@link SealedEnvelope} — encrypted payload schema
 *
 * @since 0.1.0
 * @category seal
 */
