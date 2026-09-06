/**
 * RFC 5869 extract-and-expand key derivation with SHA-256 or SHA-512.
 *
 * @remarks
 * `info` supplies application context for domain separation. An absent salt
 * uses the RFC-defined all-zero value whose length matches the selected hash.
 *
 * @see {@link hmacSha256}
 * @see {@link blake3DeriveKey}
 *
 * @since 0.1.0
 * @category key-derivation
 * @module
 */

import { hkdf } from "@noble/hashes/hkdf.js"
import { sha256 } from "@noble/hashes/sha2.js"
import { sha512 } from "@noble/hashes/sha2.js"
import { Effect, Option } from "effect"

/**
 * Derives bytes with HKDF-SHA256 as defined by RFC 5869.
 *
 * @remarks
 * `Option.none()` supplies a hash-length all-zero salt. Invalid output lengths
 * are defects from the underlying kernel rather than typed failures.
 *
 * @param ikm - Input keying material.
 * @param salt - Salt bytes, or `None` for 32 zero bytes.
 * @param info - Application context bytes.
 * @param dkLen - Requested output length in bytes; RFC 5869 permits at most 8160.
 * @returns Derived key bytes.
 *
 * @since 0.1.0
 * @category key-derivation
 */
export const hkdfSha256 = (
  ikm: Uint8Array,
  salt: Option.Option<Uint8Array>,
  info: Uint8Array,
  dkLen: number
): Effect.Effect<Uint8Array> =>
  Effect.sync(() => hkdf(sha256, ikm, Option.getOrElse(salt, () => new Uint8Array(sha256.outputLen)), info, dkLen))

/**
 * Derives bytes with HKDF-SHA512 as defined by RFC 5869.
 *
 * @remarks
 * `Option.none()` supplies a hash-length all-zero salt. Invalid output lengths
 * are defects from the underlying kernel rather than typed failures.
 *
 * @param ikm - Input keying material.
 * @param salt - Salt bytes, or `None` for 64 zero bytes.
 * @param info - Application context bytes.
 * @param dkLen - Requested output length in bytes; RFC 5869 permits at most 16320.
 * @returns Derived key bytes.
 *
 * @since 0.1.0
 * @category key-derivation
 */
export const hkdfSha512 = (
  ikm: Uint8Array,
  salt: Option.Option<Uint8Array>,
  info: Uint8Array,
  dkLen: number
): Effect.Effect<Uint8Array> =>
  Effect.sync(() => hkdf(sha512, ikm, Option.getOrElse(salt, () => new Uint8Array(sha512.outputLen)), info, dkLen))
