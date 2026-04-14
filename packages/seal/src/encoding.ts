/**
 * Sealed envelope serialization and deserialization.
 *
 * Splits `managedNonce` output (nonce ‖ ciphertext ‖ tag) into
 * structured {@link SealedEnvelope} with base64url-encoded
 * components, and reassembles for decryption.
 *
 * Uses Effect `Encoding.encodeBase64Url` / `Encoding.decodeBase64Url`
 * for RFC 4648 base64url encoding — native Effect, returns `Either`.
 *
 * Uses `concatBytes` from `@noble/ciphers` for byte concatenation
 * — audited, safe against overlapping buffers.
 *
 * @see {@link SealedEnvelope} — the structured envelope type
 * @see {@link seal} — produces envelopes via the unified pipeline
 *
 * @since 0.1.0
 * @category encoding
 */

import { concatBytes } from "@noble/ciphers/utils.js"
import { Effect, Encoding, Match, Option, Tuple } from "effect"
import { AES_GCM_NONCE_BYTES, XCHACHA20_NONCE_BYTES } from "./internal/nonce.js"
import type { SealAlgorithm } from "./schemas/SealAlgorithm.js"
import { type EnvelopeKeyMetadataType, SealedEnvelope } from "./schemas/SealedEnvelope.js"

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
 * Split raw `managedNonce` output into a structured envelope.
 *
 * Extracts the prepended nonce (algorithm-dependent length),
 * encodes both nonce and ciphertext as base64url.
 *
 * @since 0.1.0
 * @category encoding
 */
export const packEnvelope = (
  algorithm: typeof SealAlgorithm.Type,
  raw: Uint8Array,
  metadata: EnvelopeKeyMetadataType = {}
): Effect.Effect<SealedEnvelope> =>
  Effect.gen(function*() {
    const parts = splitAt(raw, nonceBytes(algorithm))
    const keyId = Option.fromNullable(metadata.keyId)
    const keyVersion = Option.fromNullable(metadata.keyVersion)

    return new SealedEnvelope({
      algorithm,
      nonce: Encoding.encodeBase64Url(Tuple.getFirst(parts)),
      ciphertext: Encoding.encodeBase64Url(Tuple.getSecond(parts)),
      ...Option.match(keyId, {
        onNone: () => ({}),
        onSome: (value) => ({ keyId: value })
      }),
      ...Option.match(keyVersion, {
        onNone: () => ({}),
        onSome: (value) => ({ keyVersion: value })
      })
    })
  })

/**
 * Reassemble a structured envelope into raw bytes for decryption.
 *
 * Decodes base64url nonce and ciphertext, concatenates as
 * nonce ‖ ciphertext for `managedNonce` decrypt.
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
