/**
 * RFC 5869 extract-and-expand key derivation with SHA-256 or SHA-512.
 *
 * @since 0.7.0
 * @module
 */

import { hkdf } from "@noble/hashes/hkdf.js"
import { sha256 as nobleSha256, sha512 as nobleSha512 } from "@noble/hashes/sha2.js"
import { Either, Option, Schema } from "effect"

/**
 * Reports a requested HKDF output length outside the selected hash's RFC 5869 range.
 *
 * @since 0.7.0
 * @category errors
 */
export class InvalidLength extends Schema.TaggedError<InvalidLength>()(
  "@scenesystems/digest/Hkdf/InvalidLength",
  {},
  { identifier: "@scenesystems/digest/Hkdf/InvalidLength" }
) {}

const derive = (
  hash: typeof nobleSha256 | typeof nobleSha512,
  ikm: Uint8Array,
  salt: Option.Option<Uint8Array>,
  info: Uint8Array,
  length: number
): Either.Either<Uint8Array, InvalidLength> =>
  Number.isSafeInteger(length) && length >= 0 && length <= 255 * hash.outputLen
    ? Either.right(hkdf(hash, ikm, Option.getOrElse(salt, () => new Uint8Array(hash.outputLen)), info, length))
    : Either.left(new InvalidLength({}))

/**
 * Derives 0 through 8160 bytes with HKDF-SHA256.
 * `ikm` is input keying material and `info` supplies domain separation.
 * `Option.none()` uses 32 zero salt bytes. Rejects non-integer and out-of-range
 * lengths before deriving secret material. Inputs are not modified.
 *
 * @since 0.7.0
 * @category key derivation
 */
export const sha256 = (
  ikm: Uint8Array,
  salt: Option.Option<Uint8Array>,
  info: Uint8Array,
  length: number
): Either.Either<Uint8Array, InvalidLength> => derive(nobleSha256, ikm, salt, info, length)

/**
 * Derives 0 through 16320 bytes with HKDF-SHA512.
 * `ikm` is input keying material and `info` supplies domain separation.
 * `Option.none()` uses 64 zero salt bytes. Rejects non-integer and out-of-range
 * lengths before deriving secret material. Inputs are not modified.
 *
 * @since 0.7.0
 * @category key derivation
 */
export const sha512 = (
  ikm: Uint8Array,
  salt: Option.Option<Uint8Array>,
  info: Uint8Array,
  length: number
): Either.Either<Uint8Array, InvalidLength> => derive(nobleSha512, ikm, salt, info, length)
