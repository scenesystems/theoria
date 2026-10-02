/**
 * BLAKE3 keyed authentication and context-separated key derivation.
 *
 * @since 0.7.0
 * @module
 */

import { blake3 } from "@noble/hashes/blake3.js"
import { Effect, Number, Result, Schema } from "effect"

import * as Utf8 from "./Utf8.js"

/**
 * Reports a BLAKE3 keyed-mode key whose length is not 32 bytes.
 *
 * @since 0.7.0
 * @category errors
 */
export class InvalidKeyLength extends Schema.TaggedError<InvalidKeyLength>()(
  "InvalidKeyLength",
  {
    /** Required key length in bytes. */
    expected: Schema.Finite,
    /** Supplied key length in bytes; no key material is retained. */
    actual: Schema.Finite
  },
  { identifier: "@scenesystems/digest/Blake3/InvalidKeyLength" }
) {}

/**
 * Reports a requested BLAKE3 output length that is not a non-negative safe integer.
 *
 * @since 0.7.0
 * @category errors
 */
export class InvalidLength extends Schema.TaggedError<InvalidLength>()(
  "@scenesystems/digest/Blake3/InvalidLength",
  {},
  { identifier: "@scenesystems/digest/Blake3/InvalidLength" }
) {}

/**
 * Computes a 32-byte authenticator with BLAKE3 keyed mode.
 * Requires exactly 32 key bytes. Does not mutate caller-owned inputs or perform
 * verification; compare authenticators in constant time at the protocol boundary.
 *
 * @since 0.7.0
 * @category authentication
 */
export const mac = (
  key: Uint8Array,
  message: Uint8Array
): Effect.Effect<Uint8Array, InvalidKeyLength> =>
  Effect.suspend(() =>
    Effect.fromResult(
      Result.liftPredicate(
        (key: Uint8Array) => Number.Equivalence(key.length, 32),
        (key) => new InvalidKeyLength({ expected: 32, actual: key.length })
      )(key)
    ).pipe(Effect.map((key) => blake3(message, { key })))
  )

/**
 * Derives key material under a strictly encoded UTF-8 context.
 *
 * Use an application-specific domain-separation context; it is not normalized.
 * The requested byte length defaults to 32 and must be a non-negative safe
 * integer, including zero. Validate an application-specific allocation bound
 * when lengths are externally controlled: allocation failures for admitted
 * lengths remain runtime defects. The input key material is not modified.
 *
 * @since 0.7.0
 * @category key derivation
 */
export const deriveKey = (
  context: string,
  input: Uint8Array,
  length = 32
): Effect.Effect<Uint8Array, Utf8.InvalidUnicode | InvalidLength> =>
  Effect.gen(function*() {
    yield* Effect.suspend(() =>
      Effect.fromResult(
        Result.liftPredicate(
          Schema.is(Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))),
          () => new InvalidLength({})
        )(length)
      )
    )
    const encodedContext = yield* Utf8.encode(context)
    return yield* Effect.sync(() => blake3(input, { context: encodedContext, dkLen: length }))
  })
