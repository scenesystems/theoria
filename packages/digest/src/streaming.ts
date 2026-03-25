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
import { Effect, Layer, Match, Stream } from "effect"
import { toBase64Url, toHex } from "./encoding.js"
import type { DigestAlgorithm } from "./schemas/DigestAlgorithm.js"

const HIGH_SURROGATE_START = 0xd800
const HIGH_SURROGATE_END = 0xdbff

const makeHasher = (algorithm: DigestAlgorithm) =>
  Match.value(algorithm).pipe(
    Match.when("blake3-256", () => blake3.create()),
    Match.when("sha256", () => nobleSha256.create()),
    Match.exhaustive
  )

const isTrailingHighSurrogate = (text: string): boolean =>
  text.length > 0 &&
  text.charCodeAt(text.length - 1) >= HIGH_SURROGATE_START &&
  text.charCodeAt(text.length - 1) <= HIGH_SURROGATE_END

const splitTextForUtf8Boundary = (text: string): readonly [emit: string, carry: string] =>
  isTrailingHighSurrogate(text) ? [text.slice(0, -1), text.slice(-1)] : [text, ""]

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
): Effect.Effect<Uint8Array, E, R> =>
  Effect.flatMap(Effect.sync(() => makeHasher(algorithm)), (hasher) =>
    chunks.pipe(
      Stream.runFold(hasher, (state, chunk) => {
        state.update(chunk)
        return state
      }),
      Effect.map((state) => state.digest())
    ))

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
): Effect.Effect<Uint8Array, E, R> =>
  Effect.flatMap(Effect.sync(() => makeHasher(algorithm)), (hasher) =>
    chunks.pipe(
      // Keep a trailing high surrogate in carry to avoid splitting UTF-8 code points across chunks.
      Stream.runFold("", (carry, chunk) => {
        const [emit, nextCarry] = splitTextForUtf8Boundary(carry + chunk)
        if (emit.length > 0) {
          hasher.update(utf8ToBytes(emit))
        }
        return nextCarry
      }),
      Effect.map((carry) => {
        if (carry.length > 0) {
          hasher.update(utf8ToBytes(carry))
        }
        return hasher.digest()
      })
    ))

/**
 * Hash a stream of UTF-8 text chunks and encode the digest as base64url.
 *
 * Returns a 43-character output for 256-bit digests.
 *
 * @since 0.1.1
 * @category digest
 */
export const digestUtf8StreamBase64Url = <E, R>(
  algorithm: DigestAlgorithm,
  chunks: Stream.Stream<string, E, R>
): Effect.Effect<string, E, R> => Effect.map(digestUtf8Stream(algorithm, chunks), toBase64Url)

/**
 * Hash a stream of UTF-8 text chunks and encode the digest as lowercase hex.
 *
 * Returns a 64-character output for 256-bit digests.
 *
 * @since 0.1.1
 * @category digest
 */
export const digestUtf8StreamHex = <E, R>(
  algorithm: DigestAlgorithm,
  chunks: Stream.Stream<string, E, R>
): Effect.Effect<string, E, R> => Effect.map(digestUtf8Stream(algorithm, chunks), toHex)

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

/**
 * Injectable streaming digest service.
 *
 * Use this service when consumers should depend on digest capabilities via
 * Effect layers rather than importing concrete helpers directly.
 *
 * @since 0.1.1
 * @category services
 */
export class DigestStreaming extends Effect.Tag("@scenesystems/digest/DigestStreaming")<
  DigestStreaming,
  {
    readonly digestByteStream: <E, R>(
      algorithm: DigestAlgorithm,
      chunks: Stream.Stream<Uint8Array, E, R>
    ) => Effect.Effect<Uint8Array, E, R>
    readonly digestUtf8Stream: <E, R>(
      algorithm: DigestAlgorithm,
      chunks: Stream.Stream<string, E, R>
    ) => Effect.Effect<Uint8Array, E, R>
    readonly digestUtf8StreamBase64Url: <E, R>(
      algorithm: DigestAlgorithm,
      chunks: Stream.Stream<string, E, R>
    ) => Effect.Effect<string, E, R>
    readonly digestUtf8StreamHex: <E, R>(
      algorithm: DigestAlgorithm,
      chunks: Stream.Stream<string, E, R>
    ) => Effect.Effect<string, E, R>
    readonly digestByteStreamBase64Url: <E, R>(
      algorithm: DigestAlgorithm,
      chunks: Stream.Stream<Uint8Array, E, R>
    ) => Effect.Effect<string, E, R>
    readonly digestByteStreamHex: <E, R>(
      algorithm: DigestAlgorithm,
      chunks: Stream.Stream<Uint8Array, E, R>
    ) => Effect.Effect<string, E, R>
  }
>() {}

/**
 * Live layer for {@link DigestStreaming}.
 *
 * @since 0.1.1
 * @category layers
 */
export const DigestStreamingLive = Layer.succeed(DigestStreaming, {
  digestByteStream,
  digestUtf8Stream,
  digestUtf8StreamBase64Url,
  digestUtf8StreamHex,
  digestByteStreamBase64Url,
  digestByteStreamHex
})
