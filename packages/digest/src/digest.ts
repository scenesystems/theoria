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

import { Effect, Match } from "effect"
import { blake3Hash } from "./algorithms/blake3.js"
import { sha256 } from "./algorithms/sha256.js"
import { canonicalize } from "./canonicalize.js"
import { toBase64Url } from "./encoding.js"
import { utf8ToBytes } from "./internal/bytes.js"
import type { FingerprintUnsupportedValue } from "./schemas/errors.js"

const hashBytes = (algorithm: "blake3-256" | "sha256", bytes: Uint8Array) =>
  Match.value(algorithm).pipe(
    Match.when("blake3-256", () => blake3Hash(bytes)),
    Match.when("sha256", () => sha256(bytes)),
    Match.exhaustive
  )

/**
 * Digest a structured value through the full pipeline.
 *
 * Returns an algorithm-tagged string: `"<algorithm>:<base64url>"`.
 *
 * @since 0.1.0
 * @category digest
 */
export const digest = (
  algorithm: "blake3-256" | "sha256",
  value: unknown
): Effect.Effect<string, FingerprintUnsupportedValue> =>
  Effect.gen(function*() {
    const canonical = yield* canonicalize(value)
    const bytes = utf8ToBytes(canonical)
    const hash = yield* hashBytes(algorithm, bytes)
    const encoded = yield* toBase64Url(hash)
    return `${algorithm}:${encoded}`
  })
