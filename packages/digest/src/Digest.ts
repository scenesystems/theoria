/**
 * Cryptographic hashing of exact bytes or strict UTF-8 text. Hashes provide
 * integrity, not authenticity. Structured-data identity belongs to ContentDigest.
 *
 * @since 0.7.0
 * @module
 */

import { blake3 } from "@noble/hashes/blake3.js"
import { sha256 } from "@noble/hashes/sha2.js"
import { type Effect, Either, Match, Schema, type Stream } from "effect"
import * as streaming from "./internal/digestStream.js"
import * as Utf8 from "./Utf8.js"

/**
 * Stable wire identifiers for the supported 256-bit hash algorithms.
 * @since 0.7.0
 * @category models
 */
export const Algorithm = Schema.Literal("blake3-256", "sha256").annotations({
  identifier: "@scenesystems/digest/Digest/Algorithm"
})

/**
 * A supported 256-bit algorithm; decode unknown identifiers with `Algorithm`.
 * @since 0.7.0
 * @category models
 */
export type Algorithm = typeof Algorithm.Type

/**
 * Hashes an exact byte preimage to a newly allocated 32-byte digest. Pure and
 * synchronous; the input is not modified. Compose with Effect's `Encoding`
 * for hexadecimal or base64url output. No provider or randomness is required.
 *
 * @since 0.7.0
 * @category hashing
 */
export const hash = (algorithm: Algorithm, bytes: Uint8Array): Uint8Array =>
  Match.value(algorithm).pipe(
    Match.when("blake3-256", () => blake3(bytes)),
    Match.when("sha256", () => sha256(bytes)),
    Match.exhaustive
  )

/**
 * Hashes strict UTF-8 without normalization or replacement. An unpaired
 * surrogate fails at its zero-based UTF-16 code-unit index.
 *
 * @since 0.7.0
 * @category hashing
 */
export const hashString = (algorithm: Algorithm, text: string): Either.Either<Uint8Array, Utf8.InvalidUnicode> =>
  Either.map(Utf8.encode(text), (bytes) => hash(algorithm, bytes))

/**
 * Hashes byte chunks in order without concatenating the input. Chunk boundaries
 * do not affect the result. Retains upstream failures and requirements. Each
 * execution allocates its own hasher and destroys it on completion, failure, or
 * interruption; JavaScript does not guarantee secure memory zeroization.
 *
 * @since 0.7.0
 * @category streaming
 */
export const hashStream: <E, R>(
  algorithm: Algorithm,
  chunks: Stream.Stream<Uint8Array, E, R>
) => Effect.Effect<Uint8Array, E, R> = streaming.hashStream

/**
 * Hashes logical text across chunks, allowing surrogate pairs to span chunk
 * boundaries. Invalid Unicode indices are absolute UTF-16 code-unit offsets in
 * the concatenation. Preserves upstream errors and requirements and uses the
 * same per-execution resource lifetime as `hashStream`.
 *
 * @since 0.7.0
 * @category streaming
 */
export const hashStringStream: <E, R>(
  algorithm: Algorithm,
  chunks: Stream.Stream<string, E, R>
) => Effect.Effect<Uint8Array, E | Utf8.InvalidUnicode, R> = streaming.hashStringStream
