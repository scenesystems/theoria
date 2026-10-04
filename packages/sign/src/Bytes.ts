/**
 * Preparing message bytes and comparing cryptographic byte sequences.
 * Use `effect/encoding` directly for hex and base64 codecs.
 *
 * @since 0.5.0
 * @module
 */
import { equalBytes } from "@noble/curves/utils.js"
import { Effect, Number as N, Ref, Stream } from "effect"
import { lengthAtMost } from "./internal/schema.js"
import { copyBytes } from "./internal/verificationInput.js"
import * as Verification from "./Verification.js"

/**
 * Encodes a string as fresh UTF-8 bytes without normalization. Lone UTF-16
 * surrogates become U+FFFD; a BOM remains part of the message. No framing or
 * domain separation is added. Encoding and allocation happen on execution.
 * @since 0.5.0
 * @category conversions
 */
export const fromString = (self: string): Effect.Effect<Uint8Array> =>
  Stream.make(self).pipe(Stream.encodeText, Stream.mkUint8Array)

/**
 * BUFFERED: collects a byte stream into one fresh array, up to the inclusive
 * `Verification.maxMessageBytes` policy limit. Every chunk is defensively
 * admitted before traversal. Upstream failures, requirements, interruption,
 * and finalization are preserved; an oversized input fails with the
 * material-free strict-verification input error.
 *
 * This operation does not incrementally sign, prehash, or change any signature
 * mode.
 * @since 0.5.0
 * @category conversions
 */
export const collect = <E, R>(
  self: Stream.Stream<Uint8Array, E, R>
): Effect.Effect<Uint8Array, E | Verification.InvalidInput, R> =>
  Effect.gen(function*() {
    const total = yield* Ref.make(0)
    return yield* self.pipe(
      Stream.mapEffect((chunk) =>
        Effect.gen(function*() {
          const used = yield* Ref.get(total)
          const detached = yield* copyBytes(chunk, lengthAtMost(N.subtract(Verification.maxMessageBytes, used)))
          yield* Ref.update(total, N.sum(detached.length))
          return detached
        })
      ),
      Stream.filter((chunk) => N.isGreaterThan(chunk.length, 0)),
      Stream.mkUint8Array
    )
  })

/**
 * Compares equal-length arrays without data-dependent early exit. Different
 * lengths return false immediately, so length is observable. This is a byte
 * comparison, not a guarantee of constant-time execution by the JS runtime.
 * @since 0.5.0
 * @category comparison
 */
export const equal = (self: Uint8Array, that: Uint8Array): boolean => equalBytes(self, that)
