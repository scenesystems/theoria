/**
 * Conversion between nonce-prefixed ciphertext bytes and {@link SealedEnvelope} values.
 *
 * @since 0.1.0
 * @category encoding
 */

import { concatBytes } from "@noble/ciphers/utils.js"
import { Effect, Encoding, Match, Tuple } from "effect"
import { AES_GCM_NONCE_BYTES, XCHACHA20_NONCE_BYTES } from "./internal/nonce.js"
import type { SealAlgorithm } from "./schemas/SealAlgorithm.js"
import { SealedEnvelope } from "./schemas/SealedEnvelope.js"

const nonceBytes = (algorithm: typeof SealAlgorithm.Type): number =>
  Match.value(algorithm).pipe(
    Match.when("xchacha20-poly1305", () => XCHACHA20_NONCE_BYTES),
    Match.when("aes-256-gcm-siv", () => AES_GCM_NONCE_BYTES),
    Match.when("aes-256-gcm", () => AES_GCM_NONCE_BYTES),
    Match.exhaustive
  )

const splitAt = (raw: Uint8Array, offset: number): readonly [Uint8Array, Uint8Array] =>
  Tuple.make(raw.subarray(0, offset), raw.subarray(offset))

/**
 * Splits nonce-prefixed ciphertext into unpadded base64url envelope fields.
 *
 * @remarks
 * This operation only partitions and encodes bytes; it does not validate ciphertext or
 * authenticate the envelope. It takes the first 24 bytes for XChaCha20-Poly1305 and the first
 * 12 bytes for either AES algorithm, even when `raw` is shorter than that length.
 *
 * @param algorithm - Algorithm that determines the nonce length and envelope discriminator.
 * @param raw - Nonce followed by ciphertext and its authentication tag.
 * @returns An Effect that succeeds with a newly allocated {@link SealedEnvelope}.
 *
 * @since 0.1.0
 * @category encoding
 */
export const packEnvelope = (
  algorithm: typeof SealAlgorithm.Type,
  raw: Uint8Array
): Effect.Effect<SealedEnvelope> =>
  Effect.gen(function*() {
    const parts = splitAt(raw, nonceBytes(algorithm))
    return new SealedEnvelope({
      algorithm,
      nonce: Encoding.encodeBase64Url(Tuple.getFirst(parts)),
      ciphertext: Encoding.encodeBase64Url(Tuple.getSecond(parts))
    })
  })

/**
 * Decodes and concatenates an envelope's nonce and ciphertext fields.
 *
 * @remarks
 * This operation does not check that the nonce length matches `algorithm` and does not
 * authenticate the bytes. Either invalid base64url field fails with `Encoding.DecodeException`.
 *
 * @param envelope - Envelope containing unpadded base64url nonce and ciphertext strings.
 * @returns Newly allocated `nonce ‖ ciphertext` bytes, or an `Encoding.DecodeException`.
 *
 * @since 0.1.0
 * @category encoding
 */
export const unpackEnvelope = (
  envelope: SealedEnvelope
): Effect.Effect<Uint8Array, Encoding.DecodeException> =>
  Effect.gen(function*() {
    const nonce = yield* Encoding.decodeBase64Url(envelope.nonce)
    const ciphertext = yield* Encoding.decodeBase64Url(envelope.ciphertext)
    return concatBytes(nonce, ciphertext)
  })
