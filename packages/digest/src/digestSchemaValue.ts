/**
 * Schema-aware digest pipeline.
 *
 * Composes `Schema.encode` → JCS canonicalization → hash → base64url
 * → algorithm-tagged string in a single call. This is the canonical
 * way to produce durable content digests of typed values.
 *
 * The Schema encoding step converts rich runtime types (Date, branded
 * types, etc.) into their portable JSON wire form before hashing,
 * ensuring cross-language determinism.
 *
 * ```
 * Typed Value (A)
 *   → Schema.encode(schema)(value)     // A → I (wire form)
 *   → canonicalize(wireValue)          // RFC 8785 JCS
 *   → UTF-8 encode
 *   → hash (BLAKE3-256 or SHA-256)
 *   → base64url encode
 *   → algorithm-tagged string
 * ```
 *
 * @see {@link digest} — pipeline without Schema encoding
 * @see {@link canonicalize} — JCS canonicalization stage
 * @see {@link DigestAlgorithm} — supported algorithm literals
 *
 * @since 0.1.0
 * @category digest
 */

import { Effect, type ParseResult, Schema } from "effect"
import { digest } from "./digest.js"
import type { DigestAlgorithm } from "./schemas/DigestAlgorithm.js"
import type { CanonicalizationError } from "./schemas/errors.js"

/**
 * Digest a Schema-typed value through the full pipeline.
 *
 * First encodes the value via `Schema.encode` to produce the
 * portable wire form, then runs the standard
 * canonicalize → hash → base64url pipeline.
 *
 * Schema requirements are preserved in `R`, and encoding failures remain
 * distinguishable from the closed canonicalization failures. Canonical traversal
 * is deterministic, stack-safe, and cooperative in fixed-size Effect batches.
 *
 * Default algorithm is `"blake3-256"`.
 *
 * @since 0.1.0
 * @category digest
 */
export const digestSchemaValue = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  value: A,
  algorithm: DigestAlgorithm = "blake3-256"
): Effect.Effect<string, CanonicalizationError | ParseResult.ParseError, R> =>
  Effect.flatMap(Schema.encode(schema)(value), (encoded) => digest(algorithm, encoded))
