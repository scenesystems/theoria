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
 * @module
 */

import { Boolean as B, Data, Effect, Number as N, Option, Schema, Stream, String as Str, Tuple } from "effect"
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

const isTrailingHighSurrogate = (text: string): boolean =>
  Option.exists(
    Str.charCodeAt(text, N.decrement(Str.length(text))),
    N.between({ minimum: 0xd800, maximum: 0xdbff })
  )

const splitTextForUtf8Boundary = (text: string) =>
  B.match(isTrailingHighSurrogate(text), {
    onTrue: () => Tuple.make(Str.slice(0, -1)(text), Str.slice(-1)(text)),
    onFalse: () => Tuple.make(text, "")
  })

class CarriedHighSurrogate extends Schema.Class<CarriedHighSurrogate>("CarriedHighSurrogate")({
  value: Schema.String,
  codeUnitIndex: Schema.NonNegativeInt
}) {}

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
    onSome: (carry) => Str.concat(carry.value, chunk)
  })
  const windowStart = Option.match(state.carriedHighSurrogate, {
    onNone: () => state.consumedCodeUnits,
    onSome: (carry) => carry.codeUnitIndex
  })
  const [emit, nextCarry] = splitTextForUtf8Boundary(window)

  return Option.match(unicodeFault(emit), {
    onNone: () =>
      Effect.sync(() => updateIncrementalHasher(state.hasher, encodeUtf8Unchecked(emit))).pipe(
        Effect.when(() => Str.isNonEmpty(emit)),
        Effect.as(
          new TextDigestState({
            hasher: state.hasher,
            carriedHighSurrogate: Option.liftPredicate(Str.isNonEmpty)(nextCarry).pipe(
              Option.map((value) =>
                new CarriedHighSurrogate({ value, codeUnitIndex: N.sum(windowStart, Str.length(emit)) })
              )
            ),
            consumedCodeUnits: N.sum(state.consumedCodeUnits, Str.length(chunk))
          })
        )
      ),
    onSome: (fault) =>
      Effect.fail(
        new InvalidUnicode({
          kind: fault.kind,
          codeUnitIndex: N.sum(windowStart, fault.codeUnitIndex)
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
 * import { Effect, Stream, String as Str } from "effect"
 *
 * export const sameDigest = Effect.gen(function*() {
 *   const first = yield* encodeUtf8("scene-")
 *   const second = yield* encodeUtf8("systems")
 *   const split = yield* digestByteStream("blake3-256", Stream.make(first, second))
 *   const whole = yield* encodeUtf8("scene-systems")
 *   const joined = yield* digestByteStream("blake3-256", Stream.make(whole))
 *   return yield* Effect.succeed(split).pipe(
 *     Effect.filterOrFail(
 *       (digest) => Str.Equivalence(toHex(digest), toHex(joined)),
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
