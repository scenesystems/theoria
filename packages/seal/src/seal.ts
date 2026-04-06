/**
 * Unified encrypt/decrypt pipeline.
 *
 * Composes the full authenticated encryption pipeline in a single
 * call with algorithm selection:
 *
 * ```
 * Plaintext (Uint8Array)
 *   → select algorithm
 *   → validate key
 *   → generate nonce
 *   → encrypt with AEAD (managedNonce handles nonce prepending)
 *   → encode as SealedEnvelope
 * ```
 *
 * Decryption reverses the process:
 *
 * ```
 * SealedEnvelope
 *   → decode envelope (extract algorithm, nonce, ciphertext + tag)
 *   → select algorithm
 *   → validate key
 *   → decrypt with AEAD (managedNonce extracts prepended nonce)
 *   → Plaintext (Uint8Array)
 * ```
 *
 * The `seal` function always produces a `SealedEnvelope` containing
 * the algorithm identifier, enabling `unseal` to select the correct
 * cipher automatically.
 *
 * @see {@link SealAlgorithm} — algorithm union schema
 * @see {@link xchacha20} — recommended AEAD algorithm
 * @see {@link aesgcmsiv} — nonce-misuse resistant alternative
 * @see {@link aesgcm} — compatibility alternative
 * @see {@link SealedEnvelope} — output envelope type
 *
 * @since 0.1.0
 * @category seal
 */

import { Effect, Match } from "effect"
import { aesgcmDecrypt, aesgcmEncrypt } from "./algorithms/aesgcm.js"
import { aesgcmsivDecrypt, aesgcmsivEncrypt } from "./algorithms/aesgcmsiv.js"
import { xchacha20Decrypt, xchacha20Encrypt } from "./algorithms/xchacha20.js"
import { packEnvelope, unpackEnvelope } from "./encoding.js"
import { DecryptionFailed, type InvalidKey } from "./schemas/errors.js"
import type { SealAlgorithm } from "./schemas/SealAlgorithm.js"
import type { EnvelopeKeyMetadataType, SealedEnvelope } from "./schemas/SealedEnvelope.js"

/**
 * Encrypt `plaintext` and wrap in a self-describing envelope.
 *
 * Dispatches to the selected algorithm, then packs the raw
 * output (nonce ‖ ciphertext ‖ tag) into a {@link SealedEnvelope}.
 *
 * @since 0.1.0
 * @category seal
 */
export const seal = (
  algorithm: typeof SealAlgorithm.Type,
  key: Uint8Array,
  plaintext: Uint8Array,
  metadata: EnvelopeKeyMetadataType = {}
): Effect.Effect<SealedEnvelope, InvalidKey> =>
  Effect.gen(function*() {
    const raw = yield* Match.value(algorithm).pipe(
      Match.when("xchacha20-poly1305", () => xchacha20Encrypt(key, plaintext)),
      Match.when("aes-256-gcm-siv", () => aesgcmsivEncrypt(key, plaintext)),
      Match.when("aes-256-gcm", () => aesgcmEncrypt(key, plaintext)),
      Match.exhaustive
    )
    return yield* packEnvelope(algorithm, raw, metadata)
  })

/**
 * Decrypt a self-describing {@link SealedEnvelope}.
 *
 * Reads the algorithm from the envelope, unpacks the raw bytes,
 * and dispatches to the correct algorithm for decryption.
 *
 * @since 0.1.0
 * @category seal
 */
export const unseal = (
  key: Uint8Array,
  envelope: SealedEnvelope
): Effect.Effect<Uint8Array, DecryptionFailed | InvalidKey> =>
  Effect.gen(function*() {
    const raw = yield* unpackEnvelope(envelope).pipe(
      Effect.mapError(() =>
        new DecryptionFailed({
          algorithm: envelope.algorithm,
          reason: "invalid envelope encoding"
        })
      )
    )
    return yield* Match.value(envelope.algorithm).pipe(
      Match.when("xchacha20-poly1305", () => xchacha20Decrypt(key, raw)),
      Match.when("aes-256-gcm-siv", () => aesgcmsivDecrypt(key, raw)),
      Match.when("aes-256-gcm", () => aesgcmDecrypt(key, raw)),
      Match.exhaustive
    )
  })
