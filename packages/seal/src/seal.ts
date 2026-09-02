/**
 * Algorithm-dispatched encryption and decryption using {@link SealedEnvelope} values.
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
import type { SealedEnvelope } from "./schemas/SealedEnvelope.js"

/**
 * Encrypts bytes with a generated nonce and returns a {@link SealedEnvelope}.
 *
 * @remarks
 * The caller supplies and retains the key. It must be exactly 32 bytes and not all zero.
 * The returned `nonce` and `ciphertext` fields are unpadded base64url; the authentication
 * tag is included in `ciphertext`. Nonces come from the runtime cryptographic random source.
 * No supported operation accepts AAD. `key` and `plaintext` are not mutated.
 *
 * @param algorithm - Cipher to use and record in the envelope.
 * @param key - Caller-owned 32-byte key; it is neither copied into nor retained by the envelope.
 * @param plaintext - Bytes to encrypt.
 * @returns A fresh encoded envelope, or {@link InvalidKey}.
 *
 * @since 0.1.0
 * @category seal
 */
export const seal = (
  algorithm: typeof SealAlgorithm.Type,
  key: Uint8Array,
  plaintext: Uint8Array
): Effect.Effect<SealedEnvelope, InvalidKey> =>
  Effect.gen(function*() {
    const raw = yield* Match.value(algorithm).pipe(
      Match.when("xchacha20-poly1305", () => xchacha20Encrypt(key, plaintext)),
      Match.when("aes-256-gcm-siv", () => aesgcmsivEncrypt(key, plaintext)),
      Match.when("aes-256-gcm", () => aesgcmEncrypt(key, plaintext)),
      Match.exhaustive
    )
    return yield* packEnvelope(algorithm, raw)
  })

/**
 * Authenticates and decrypts a {@link SealedEnvelope} using its recorded algorithm.
 *
 * @remarks
 * The caller must supply the same key used to seal the value. Invalid base64url fails with
 * {@link DecryptionFailed} reason `invalid envelope encoding`; wrong keys, modified data,
 * malformed nonce/ciphertext lengths, and authentication failures use reason
 * `authentication failed`. These failures intentionally do not reveal which condition occurred.
 * Neither input is mutated; successful decryption returns newly allocated plaintext.
 *
 * @param key - Caller-owned 32-byte key; it must not be all zero.
 * @param envelope - Envelope whose algorithm, nonce, and ciphertext are used for decryption.
 * @returns Fresh plaintext bytes, or {@link InvalidKey} or {@link DecryptionFailed}.
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
