/**
 * Unified digest pipeline.
 *
 * Composes the full content-addressing pipeline in a single call:
 *
 * ```
 * Structured Value
 *   → canonicalize (RFC 8785 JCS)
 *   → UTF-8 encode
 *   → hash (BLAKE3-256 or SHA-256)
 *   → base64url encode
 *   → algorithm-tagged string
 * ```
 *
 * @see {@link canonicalize} — first stage: deterministic JSON serialization
 * @see {@link blake3Hash} — primary hash function
 * @see {@link sha256} — secondary hash function
 * @see {@link toBase64Url} — final stage: byte-to-string encoding
 * @see {@link DigestAlgorithm} — supported algorithm literals
 *
 * @since 0.1.0
 * @category digest
 */

import { Effect } from "effect"
import { canonicalize } from "./canonicalize.js"
import { digestBytesTagged } from "./internal/digest-bytes.js"
import { encodeUtf8Unchecked } from "./internal/unicode.js"
import type { DigestAlgorithm } from "./schemas/DigestAlgorithm.js"
import type { CanonicalizationError } from "./schemas/errors.js"

/**
 * Produces a self-describing digest for a canonical structured value.
 *
 * @remarks
 * Returns an algorithm-tagged string: `"<algorithm>:<base64url>"`. The
 * canonicalization stage is strict and stack-safe, preserves admitted Unicode
 * exactly, and rejects malformed or unsupported values with bounded errors.
 *
 * @param algorithm - Algorithm recorded in and used to produce the result.
 * @param value - Value in the strict canonical plain-data domain.
 * @returns `<algorithm>:<base64url>`, or a canonicalization failure.
 *
 * @since 0.1.0
 * @category digest
 */
export const digest = (
  algorithm: DigestAlgorithm,
  value: unknown
): Effect.Effect<string, CanonicalizationError> =>
  Effect.gen(function*() {
    const canonical = yield* canonicalize(value)
    const bytes = encodeUtf8Unchecked(canonical)
    return yield* digestBytesTagged(algorithm, bytes)
  })
