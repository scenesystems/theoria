/**
 * BLAKE3 multi-mode cryptographic hashing.
 *
 * Exposes default hashing, keyed mode, and context-separated key derivation.
 * Outputs are raw bytes so callers can choose their wire encoding.
 *
 * @example
 * ```ts
 * import { blake3Hash, blake3Mac, blake3DeriveKey } from "@scenesystems/digest"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const hash = yield* blake3Hash(new Uint8Array([1, 2, 3]))
 *   const mac = yield* blake3Mac(new Uint8Array(32), new Uint8Array([4, 5, 6]))
 *   const derived = yield* blake3DeriveKey("my-app/cache", new Uint8Array([7, 8, 9]))
 * })
 * ```
 *
 * @see {@link hmacSha256} — HMAC-based MAC for external protocol compatibility
 * @see {@link sha256} — secondary algorithm for FIPS compatibility
 * @see {@link toBase64Url} — encode output bytes to base64url
 *
 * @since 0.1.0
 * @category algorithms
 */

import { blake3 } from "@noble/hashes/blake3.js"
import { Effect, Option } from "effect"
import { encodeUtf8 } from "../encoding.js"
import { InvalidKeyLength } from "../schemas/errors.js"
import type { InvalidUnicode } from "../schemas/errors.js"

/**
 * Produces the 32-byte BLAKE3 digest in default mode.
 *
 * @param input - Bytes to hash; the array is not modified.
 * @returns An Effect that succeeds with a newly allocated digest.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const blake3Hash = (input: Uint8Array): Effect.Effect<Uint8Array> => Effect.sync(() => blake3(input))

/**
 * Authenticates a message with BLAKE3 keyed mode.
 *
 * @param key - Exactly 32 key bytes.
 * @param message - Message bytes to authenticate.
 * @returns A 32-byte authenticator, or `InvalidKeyLength` before hashing.
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
 * Derives context-separated key material with BLAKE3 derive-key mode.
 *
 * @remarks
 * Context must be well-formed Unicode. It is UTF-8 encoded without
 * normalization before passing to Noble; malformed UTF-16 fails with its
 * offending code-unit index. When `dkLen` is `Option.some`, the output length
 * is set to that value; otherwise Noble defaults to 32 bytes.
 *
 * @param context - Application-specific domain string, encoded strictly as UTF-8.
 * @param input - Source key material.
 * @param dkLen - Requested byte length, or `None` for 32 bytes.
 * @returns Derived bytes, or `InvalidUnicode` for an unpaired context surrogate.
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
