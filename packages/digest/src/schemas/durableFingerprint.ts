/**
 * Deterministic, durable fingerprint for cache key identity.
 *
 * The canonical fingerprinting function consumed by `effect-search/Cache`
 * and `effect-dsp/Cache`. Composes three stages:
 *
 * 1. **Canonicalize**: RFC 8785 JCS — sorted keys, ES2015 numbers
 * 2. **Hash**: BLAKE3-256 (via `@noble/hashes/blake3.js`)
 * 3. **Encode**: base64url, no padding (via `@scure/base`)
 *
 * Returns algorithm-tagged strings: `"blake3-256:<base64url>"`.
 *
 * The preimage must already be Schema-encoded into a portable JSON
 * shape — `Date`, `BigInt`, `Uint8Array`, and other non-JSON types
 * must be pre-encoded by the caller (typically via `Schema.encode`).
 *
 * Uses BLAKE3's context mode for domain separation when a context
 * string is provided, eliminating collision risk from manual salt
 * concatenation.
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
 * @see {@link blake3} — stage 2: primary hash algorithm
 * @see {@link FingerprintUnsupportedValue} — error for non-JSON-safe inputs
 * @see {@link ContentDigest} — typed result schema
 *
 * @since 0.1.0
 * @category fingerprint
 */
