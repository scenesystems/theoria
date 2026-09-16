/**
 * RFC 8785 JSON Canonicalization Scheme (JCS). This module owns admission,
 * traversal, Unicode preservation, and canonical UTF-8 byte-limit semantics.
 *
 * @since 0.7.0
 * @module
 */

import { Effect, Schema } from "effect"
import * as traversal from "./internal/canonicalJson/traversal.js"
import { InvalidUnicode } from "./Utf8.js"

/**
 * A value outside the JSON-visible domain. Only a bounded structural reason is
 * retained, never the value, a property name, a path, or a canonical preimage.
 *
 * @since 0.7.0
 * @category errors
 */
export class UnsupportedValue extends Schema.TaggedError<UnsupportedValue>()(
  "UnsupportedValue",
  {
    reason: Schema.Literal(
      "undefined",
      "nan",
      "non-finite-number",
      "bigint",
      "function",
      "symbol",
      "date",
      "regexp",
      "typed-array",
      "map",
      "set",
      "promise",
      "sparse-array",
      "unsupported-value"
    )
  },
  { identifier: "@scenesystems/digest/CanonicalJson/UnsupportedValue" }
) {}

/**
 * A cycle along the current ancestor chain. Shared acyclic values are admitted.
 * The error retains neither object identity nor traversal path.
 *
 * @since 0.7.0
 * @category errors
 */
export class CyclicValue extends Schema.TaggedError<CyclicValue>()(
  "CyclicValue",
  {},
  { identifier: "@scenesystems/digest/CanonicalJson/CyclicValue" }
) {}

/**
 * Canonical UTF-8 output exceeded an inclusive byte limit. The wire tag remains
 * `CanonicalByteLimitExceeded`; neither the preimage nor its size is disclosed.
 *
 * @since 0.7.0
 * @category errors
 */
export class ByteLimitExceeded extends Schema.TaggedError<ByteLimitExceeded>()(
  "CanonicalByteLimitExceeded",
  {},
  { identifier: "@scenesystems/digest/CanonicalJson/ByteLimitExceeded" }
) {}

/**
 * A byte limit was not a non-negative safe integer. The rejected limit is not
 * retained. The wire tag remains `InvalidCanonicalByteLimit`.
 *
 * @since 0.7.0
 * @category errors
 */
export class InvalidByteLimit extends Schema.TaggedError<InvalidByteLimit>()(
  "InvalidCanonicalByteLimit",
  {},
  { identifier: "@scenesystems/digest/CanonicalJson/InvalidByteLimit" }
) {}

/**
 * Invalid limits and oversized admitted preimages are distinct failures.
 * @since 0.7.0
 * @category errors
 */
export const ByteLimitError = Schema.Union(InvalidByteLimit, ByteLimitExceeded).annotations({
  identifier: "@scenesystems/digest/CanonicalJson/ByteLimitError"
})

/**
 * Failure while applying an inclusive canonical byte limit.
 * @since 0.7.0
 * @category errors
 */
export type ByteLimitError = typeof ByteLimitError.Type

/**
 * Closed admission failures: malformed Unicode, unsupported data, or a cycle.
 * @since 0.7.0
 * @category errors
 */
export const Error = Schema.Union(InvalidUnicode, UnsupportedValue, CyclicValue).annotations({
  identifier: "@scenesystems/digest/CanonicalJson/Error"
})

/**
 * A canonical JSON admission failure with bounded, serializable diagnostics.
 * @since 0.7.0
 * @category errors
 */
export type Error = typeof Error.Type

/**
 * Serializes JSON-visible data with UTF-16 key ordering and ECMAScript number
 * spelling, without whitespace or normalization. Admits finite JSON primitives,
 * dense arrays, and own enumerable string-keyed record fields. Inherited,
 * symbol-keyed, non-enumerable, and non-element array properties are ignored.
 * Reads values normally; callers must keep the input graph stable until done.
 *
 * Traversal is stack-safe and yields between bounded batches. Record key
 * discovery/sorting and final joining are synchronous, not bounded interruption
 * points. Each execution owns its traversal state; interruption publishes no
 * partial result. An Effect retained by its caller can still retain its input.
 * Use the caller's Schema encoder first for non-JSON runtime representations.
 *
 * @since 0.7.0
 * @category encoding
 */
export const encode = (value: unknown): Effect.Effect<string, Error> => traversal.canonicalizeValue(value)

/**
 * Produces the exact RFC 8785 UTF-8 preimage. Shares `encode`'s admission and
 * cooperation contract. Final UTF-8 materialization is synchronous.
 *
 * @since 0.7.0
 * @category encoding
 */
export const encodeBytes = (value: unknown): Effect.Effect<Uint8Array, Error> =>
  Effect.flatMap(traversal.canonicalizeSegments(value), traversal.encodeCanonicalSegments)
