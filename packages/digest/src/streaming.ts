/**
 * Incremental hashing for byte and logical-text streams.
 *
 * @remarks
 * These helpers hash chunked streams without requiring callers to pre-concatenate
 * all bytes in memory. Text streams preserve chunk-boundary independence while
 * rejecting malformed UTF-16 with an absolute code-unit index.
 *
 * @see {@link digestBytes}
 * @see {@link digestUtf8}
 * @see https://effect.website/docs/stream/ Stream APIs
 * @see https://effect.website/docs/stream/operations/#runfoldeffect Stream.runFoldEffect
 *
 * @since 0.2.0
 * @category digest
 */

import { Data, Effect, Option, Stream } from "effect"
import { toBase64Url, toHex } from "./encoding.js"
import {
  finalizeIncrementalHasher,
  type IncrementalHasher,
  makeIncrementalHasher,
  updateIncrementalHasher
} from "./internal/digest-bytes.js"
import { encodeUtf8Unchecked, unicodeFault } from "./internal/unicode.js"
import type { DigestAlgorithm } from "./schemas/DigestAlgorithm.js"
import { InvalidUnicode } from "./schemas/errors.js"

const HIGH_SURROGATE_START = 0xd800
const HIGH_SURROGATE_END = 0xdbff

const isTrailingHighSurrogate = (text: string): boolean =>
  text.length > 0 &&
  text.charCodeAt(text.length - 1) >= HIGH_SURROGATE_START &&
  text.charCodeAt(text.length - 1) <= HIGH_SURROGATE_END

const splitTextForUtf8Boundary = (text: string): readonly [emit: string, carry: string] =>
  isTrailingHighSurrogate(text) ? [text.slice(0, -1), text.slice(-1)] : [text, ""]

class CarriedHighSurrogate extends Data.Class<{
  readonly value: string
  readonly codeUnitIndex: number
}> {}

class TextDigestState extends Data.Class<{
  readonly hasher: IncrementalHasher
  readonly carriedHighSurrogate: Option.Option<CarriedHighSurrogate>
  readonly consumedCodeUnits: number
}> {}

const foldTextChunk = (
  state: TextDigestState,
  chunk: string
): Effect.Effect<TextDigestState, InvalidUnicode> => {
  const window = Option.match(state.carriedHighSurrogate, {
    onNone: () => chunk,
    onSome: (carry) => carry.value + chunk
  })
  const windowStart = Option.match(state.carriedHighSurrogate, {
    onNone: () => state.consumedCodeUnits,
    onSome: (carry) => carry.codeUnitIndex
  })
  const [emit, nextCarry] = splitTextForUtf8Boundary(window)

  return Option.match(unicodeFault(emit), {
    onNone: () =>
      Effect.sync(() => {
        if (emit.length > 0) updateIncrementalHasher(state.hasher, encodeUtf8Unchecked(emit))

        return new TextDigestState({
          hasher: state.hasher,
          carriedHighSurrogate: nextCarry.length > 0
            ? Option.some(
              new CarriedHighSurrogate({
                value: nextCarry,
                codeUnitIndex: windowStart + emit.length
              })
            )
            : Option.none(),
          consumedCodeUnits: state.consumedCodeUnits + chunk.length
        })
      }),
    onSome: (fault) =>
      Effect.fail(
        new InvalidUnicode({
          kind: fault.kind,
          codeUnitIndex: windowStart + fault.codeUnitIndex
        })
      )
  })
}

const finishTextDigest = (state: TextDigestState): Effect.Effect<Uint8Array, InvalidUnicode> =>
  Option.match(state.carriedHighSurrogate, {
    onNone: () => finalizeIncrementalHasher(state.hasher),
    onSome: (carry) =>
      Effect.fail(
        new InvalidUnicode({
          kind: "lone-high-surrogate",
          codeUnitIndex: carry.codeUnitIndex
        })
      )
  })

/**
 * Hashes byte chunks in order without first concatenating them.
 *
 * @remarks
 * Chunk boundaries do not affect the digest. Upstream failures and service
 * requirements remain in the returned Effect.
 *
 * @typeParam E - Upstream stream error type.
 * @typeParam R - Services required by the stream.
 * @param algorithm - Digest algorithm applied incrementally.
 * @param chunks - Ordered byte chunks; boundaries do not affect the result.
 * @returns The 32-byte digest after successful stream completion.
 *
 * @example
 * ```ts
 * import { digestByteStream, encodeUtf8, toHex } from "@scenesystems/digest"
 * import { Effect, Stream } from "effect"
 *
 * export const sameDigest = Effect.gen(function*() {
 *   const first = yield* encodeUtf8("scene-")
 *   const second = yield* encodeUtf8("systems")
 *   const split = yield* digestByteStream("blake3-256", Stream.fromIterable([first, second]))
 *   const joined = yield* digestByteStream(
 *     "blake3-256",
 *     Stream.make(new Uint8Array([...first, ...second]))
 *   )
 *   return yield* Effect.succeed(split).pipe(
 *     Effect.filterOrFail(
 *       (digest) => toHex(digest) === toHex(joined),
 *       () => "ChunkBoundaryChangedDigest"
 *     )
 *   )
 * })
 * ```
 *
 * @since 0.2.0
 * @category digest
 */
export const digestByteStream = <E, R>(
  algorithm: DigestAlgorithm,
  chunks: Stream.Stream<Uint8Array, E, R>
): Effect.Effect<Uint8Array, E, R> =>
  Effect.flatMap(makeIncrementalHasher(algorithm), (hasher) =>
    chunks.pipe(
      Stream.runFold(hasher, (state, chunk) => {
        updateIncrementalHasher(state, chunk)
        return state
      }),
      Effect.flatMap(finalizeIncrementalHasher)
    ))

/**
 * Hashes strict UTF-8 text while allowing surrogate pairs to span adjacent chunks.
 *
 * @remarks
 * Malformed UTF-16 fails with an absolute code-unit index in the logical
 * concatenation of all chunks. Valid text is preserved without normalization.
 * A surrogate pair may span adjacent chunks. Upstream failures and service
 * requirements are preserved.
 *
 * @typeParam E - Upstream stream error type.
 * @typeParam R - Services required by the stream.
 * @param algorithm - Digest algorithm applied incrementally.
 * @param chunks - Ordered UTF-16 text chunks forming one logical input.
 * @returns A 32-byte digest, or the upstream error or `InvalidUnicode`.
 *
 * @since 0.2.0
 * @category digest
 */
export const digestUtf8Stream = <E, R>(
  algorithm: DigestAlgorithm,
  chunks: Stream.Stream<string, E, R>
): Effect.Effect<Uint8Array, E | InvalidUnicode, R> =>
  Effect.flatMap(makeIncrementalHasher(algorithm), (hasher) =>
    chunks.pipe(
      Stream.runFoldEffect(
        new TextDigestState({
          hasher,
          carriedHighSurrogate: Option.none<CarriedHighSurrogate>(),
          consumedCodeUnits: 0
        }),
        foldTextChunk
      ),
      Effect.flatMap(finishTextDigest)
    ))

/**
 * Encodes the streamed-text digest as 43 unpadded base64url characters.
 *
 * @remarks
 * Surrogate pairs may span chunks. Upstream failures and requirements are preserved.
 *
 * @typeParam E - Upstream stream error type.
 * @typeParam R - Services required by the stream.
 * @param algorithm - Digest algorithm applied incrementally.
 * @param chunks - Ordered UTF-16 text chunks forming one logical input.
 * @returns The encoded digest, or the upstream error or `InvalidUnicode`.
 *
 * @since 0.2.0
 * @category digest
 */
export const digestUtf8StreamBase64Url = <E, R>(
  algorithm: DigestAlgorithm,
  chunks: Stream.Stream<string, E, R>
): Effect.Effect<string, E | InvalidUnicode, R> => Effect.map(digestUtf8Stream(algorithm, chunks), toBase64Url)

/**
 * Encodes the streamed-text digest as 64 lowercase hexadecimal characters.
 *
 * @remarks
 * Surrogate pairs may span chunks. Upstream failures and requirements are preserved.
 *
 * @typeParam E - Upstream stream error type.
 * @typeParam R - Services required by the stream.
 * @param algorithm - Digest algorithm applied incrementally.
 * @param chunks - Ordered UTF-16 text chunks forming one logical input.
 * @returns The encoded digest, or the upstream error or `InvalidUnicode`.
 *
 * @since 0.2.0
 * @category digest
 */
export const digestUtf8StreamHex = <E, R>(
  algorithm: DigestAlgorithm,
  chunks: Stream.Stream<string, E, R>
): Effect.Effect<string, E | InvalidUnicode, R> => Effect.map(digestUtf8Stream(algorithm, chunks), toHex)

/**
 * Encodes the streamed-byte digest as 43 unpadded base64url characters.
 *
 * @remarks
 * Upstream failures and requirements are preserved.
 *
 * @typeParam E - Upstream stream error type.
 * @typeParam R - Services required by the stream.
 * @param algorithm - Digest algorithm applied incrementally.
 * @param chunks - Ordered byte chunks; boundaries do not affect the result.
 * @returns The encoded digest after successful stream completion.
 *
 * @since 0.2.0
 * @category digest
 */
export const digestByteStreamBase64Url = <E, R>(
  algorithm: DigestAlgorithm,
  chunks: Stream.Stream<Uint8Array, E, R>
): Effect.Effect<string, E, R> => Effect.map(digestByteStream(algorithm, chunks), toBase64Url)

/**
 * Encodes the streamed-byte digest as 64 lowercase hexadecimal characters.
 *
 * @remarks
 * Upstream failures and requirements are preserved.
 *
 * @typeParam E - Upstream stream error type.
 * @typeParam R - Services required by the stream.
 * @param algorithm - Digest algorithm applied incrementally.
 * @param chunks - Ordered byte chunks; boundaries do not affect the result.
 * @returns The encoded digest after successful stream completion.
 *
 * @since 0.2.0
 * @category digest
 */
export const digestByteStreamHex = <E, R>(
  algorithm: DigestAlgorithm,
  chunks: Stream.Stream<Uint8Array, E, R>
): Effect.Effect<string, E, R> => Effect.map(digestByteStream(algorithm, chunks), toHex)
