/**
 * Deterministic, durable fingerprint for cache key identity.
 *
 * The canonical fingerprinting function consumed by `effect-search/Cache`
 * and `effect-dsp/Cache`. Composes three stages:
 *
 * 1. **Canonicalize**: RFC 8785 JCS — sorted keys, ES2015 numbers
 * 2. **Hash**: BLAKE3-256 (via `@noble/hashes/blake3.js`)
 * 3. **Encode**: base64url, no padding (via Effect `Encoding`)
 *
 * Returns algorithm-tagged strings: `"blake3-256:<base64url>"`.
 *
 * The preimage must already be Schema-encoded into a portable JSON
 * shape — `Date`, `BigInt`, `Uint8Array`, and other non-JSON types
 * must be pre-encoded by the caller (typically via `Schema.encode`).
 *
 * @example
 * ```ts
 * import { durableFingerprint } from "@scenesystems/digest"
 * import { Effect } from "effect"
 *
 * const key = durableFingerprint({ question: "What is 2+2?" })
 * // Effect<string, FingerprintUnsupportedValue>
 * ```
 *
 * @see {@link canonicalize} — stage 1: deterministic JSON serialization
 * @see {@link blake3Hash} — stage 2: primary hash algorithm
 * @see {@link FingerprintUnsupportedValue} — error for non-JSON-safe inputs
 * @see {@link ContentDigest} — typed result schema
 *
 * @since 0.1.0
 * @category fingerprint
 */

import type { Effect } from "effect"
import { digest } from "../digest.js"
import type { FingerprintUnsupportedValue } from "./errors.js"

/**
 * Compute a durable, deterministic fingerprint of a structured value.
 *
 * Uses BLAKE3-256 as the digest algorithm. Returns an algorithm-tagged
 * string: `"blake3-256:<base64url>"`.
 *
 * @since 0.1.0
 * @category fingerprint
 */
export const durableFingerprint = (
  value: unknown
): Effect.Effect<string, FingerprintUnsupportedValue> => digest("blake3-256", value)
