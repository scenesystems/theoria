/**
 * BLAKE3 multi-mode cryptographic hashing.
 *
 * Primary digest algorithm for all content-addressing, artifact
 * integrity, and persisted cache identity across the Theoria ecosystem.
 * Wraps `@noble/hashes/blake3.js` — audited, zero-dependency, 879K
 * ops/sec for 32B inputs.
 *
 * Every operation returns `Effect<Uint8Array>` — errors are typed in
 * the channel where validation is required (e.g. `InvalidKeyLength`
 * for keyed MAC mode).
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
import { utf8ToBytes } from "@noble/hashes/utils.js"
import { Effect, Option } from "effect"
import { InvalidKeyLength } from "../schemas/errors.js"

/**
 * Hash `input` bytes using BLAKE3 default mode.
 *
 * Pure deterministic operation — no error channel.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const blake3Hash = (input: Uint8Array): Effect.Effect<Uint8Array> => Effect.sync(() => blake3(input))

/**
 * Compute BLAKE3 keyed MAC of `message` using `key`.
 *
 * Fails with `InvalidKeyLength` when key is not exactly 32 bytes.
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
 * Derive a key from `input` using BLAKE3 KDF mode with `context`
 * domain separation.
 *
 * Context must be a hardcoded ASCII string — it is UTF-8 encoded
 * internally before passing to Noble. When `dkLen` is `Option.some`,
 * the output length is set to that value; otherwise Noble defaults
 * to 32 bytes.
 *
 * @since 0.1.0
 * @category algorithms
 */
export const blake3DeriveKey = (
  context: string,
  input: Uint8Array,
  dkLen: Option.Option<number> = Option.none()
): Effect.Effect<Uint8Array> =>
  Effect.sync(() => {
    const ctx = utf8ToBytes(context)
    return Option.match(dkLen, {
      onNone: () => blake3(input, { context: ctx }),
      onSome: (len) => blake3(input, { context: ctx, dkLen: len })
    })
  })
