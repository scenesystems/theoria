/**
 * Streaming digest pipelines.
 *
 * These helpers hash chunked streams without requiring callers to pre-concatenate
 * all bytes in memory. Internally they fold with `Stream.runFold`, updating an
 * incremental hasher per chunk and emitting a final digest at stream completion.
 *
 * @see {@link digestBytes} one-shot byte hashing for non-streaming inputs
 * @see {@link digestUtf8} one-shot UTF-8 hashing for non-streaming inputs
 * @see https://effect.website/docs/stream/ Stream APIs
 * @see https://effect.website/docs/stream/operations/#runfold Stream.runFold
 *
 * @since 0.1.1
 * @category digest
 */

import { blake3 } from "@noble/hashes/blake3.js"
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js"
import { utf8ToBytes } from "@noble/hashes/utils.js"
import { Effect, Match, Stream } from "effect"
import { toBase64Url, toHex } from "./encoding.js"

type DigestAlgorithm = "blake3-256" | "sha256"

const makeHasher = (algorithm: DigestAlgorithm) =>
  Match.value(algorithm).pipe(
    Match.when("blake3-256", () => blake3.create()),
    Match.when("sha256", () => nobleSha256.create()),
    Match.exhaustive
  )

/**
 * Hash a stream of byte chunks using the specified algorithm.
 *
 * The resulting digest is invariant to chunk boundaries and depends only on
 * chunk order and byte content.
 *
 * @example
 * ```ts
 * import { digestByteStream, utf8ToBytes } from "@scenesystems/digest"
 * import { Effect, Stream } from "effect"
 *
 * const program = digestByteStream("blake3-256", Stream.fromIterable([
 *   utf8ToBytes("scene-"),
 *   utf8ToBytes("systems")
 * ]))
 * ```
 *
 * @since 0.1.1
 * @category digest
 */
export const digestByteStream = <E, R>(
  algorithm: DigestAlgorithm,
  chunks: Stream.Stream<Uint8Array, E, R>
): Effect.Effect<Uint8Array, E, R> => {
  const hasher = makeHasher(algorithm)
  return chunks.pipe(
    Stream.runFold(hasher, (state, chunk) => {
      state.update(chunk)
      return state
    }),
    Effect.map((state) => state.digest())
  )
}

/**
 * Hash a stream of UTF-8 text chunks using the specified algorithm.
 *
 * Equivalent to mapping `utf8ToBytes` over the stream and then calling
 * {@link digestByteStream}.
 *
 * @since 0.1.1
 * @category digest
 */
export const digestUtf8Stream = <E, R>(
  algorithm: DigestAlgorithm,
  chunks: Stream.Stream<string, E, R>
): Effect.Effect<Uint8Array, E, R> => digestByteStream(algorithm, chunks.pipe(Stream.map(utf8ToBytes)))

/**
 * Hash a stream of byte chunks and encode the digest as base64url.
 *
 * Returns a 43-character output for 256-bit digests.
 *
 * @since 0.1.1
 * @category digest
 */
export const digestByteStreamBase64Url = <E, R>(
  algorithm: DigestAlgorithm,
  chunks: Stream.Stream<Uint8Array, E, R>
): Effect.Effect<string, E, R> => Effect.map(digestByteStream(algorithm, chunks), toBase64Url)

/**
 * Hash a stream of byte chunks and encode the digest as lowercase hex.
 *
 * Returns a 64-character output for 256-bit digests.
 *
 * @since 0.1.1
 * @category digest
 */
export const digestByteStreamHex = <E, R>(
  algorithm: DigestAlgorithm,
  chunks: Stream.Stream<Uint8Array, E, R>
): Effect.Effect<string, E, R> => Effect.map(digestByteStream(algorithm, chunks), toHex)
