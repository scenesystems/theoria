/**
 * BLAKE3 hashing, keyed authentication, and context-separated key derivation.
 *
 * @remarks
 * Each operation returns raw bytes so the caller controls the wire encoding.
 * Use HMAC-SHA256 instead when a protocol requires HMAC, and SHA-256 when a
 * format or protocol fixes that digest algorithm.
 *
 * @see {@link hmacSha256}
 * @see {@link sha256}
 * @see {@link toBase64Url}
 *
 * @since 0.1.0
 * @category algorithms
 * @module
 */

import { blake3 } from "@noble/hashes/blake3.js"
import { Effect, Option } from "effect"
import { encodeUtf8 } from "../encoding.js"
import { InvalidKeyLength } from "../schemas/errors.js"
import type { InvalidUnicode } from "../schemas/errors.js"

/**
 * Hashes bytes with BLAKE3's default 256-bit mode.
 *
 * @param input - Bytes to hash; the array is not modified.
 * @returns A newly allocated 32-byte digest.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const blake3Hash = (input: Uint8Array): Effect.Effect<Uint8Array> => Effect.sync(() => blake3(input))

/**
 * Computes a 32-byte authenticator with BLAKE3 keyed mode.
 *
 * @param key - Exactly 32 key bytes.
 * @param message - Message bytes to authenticate.
 * @returns A newly allocated authenticator. A key of any other length fails
 * with `InvalidKeyLength` before hashing starts.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const blake3Mac = (
  key: Uint8Array,
  message: Uint8Array
): Effect.Effect<Uint8Array, InvalidKeyLength> =>
  key.length !== 32
    ? new InvalidKeyLength({ expected: 32, actual: key.length })
    : Effect.sync(() => blake3(message, { key }))

/**
 * Derives key material under a UTF-8 domain-separation context.
 *
 * @remarks
 * The context is encoded without Unicode normalization. An unpaired UTF-16
 * surrogate fails with its code-unit index. `Option.none()` leaves the output
 * at BLAKE3's 32-byte default.
 *
 * @param context - Application-specific domain string, encoded strictly as UTF-8.
 * @param input - Source key material.
 * @param dkLen - Requested byte length, or `None` for 32 bytes.
 * @returns Newly allocated key material, or `InvalidUnicode` for an unpaired
 * context surrogate.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const blake3DeriveKey = (
  context: string,
  input: Uint8Array,
  dkLen: Option.Option<number> = Option.none()
): Effect.Effect<Uint8Array, InvalidUnicode> =>
  Effect.flatMap(encodeUtf8(context), (ctx) =>
    Effect.sync(() =>
      Option.match(dkLen, {
        onNone: () => blake3(input, { context: ctx }),
        onSome: (len) => blake3(input, { context: ctx, dkLen: len })
      })
    ))
