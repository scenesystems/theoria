/**
 * Streaming digest pipelines.
 *
 * These helpers hash chunked streams without requiring callers to pre-concatenate
 * all bytes in memory.
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
 * @since 0.1.1
 * @category digest
 */
export const digestByteStreamHex = <E, R>(
  algorithm: DigestAlgorithm,
  chunks: Stream.Stream<Uint8Array, E, R>
): Effect.Effect<string, E, R> => Effect.map(digestByteStream(algorithm, chunks), toHex)
