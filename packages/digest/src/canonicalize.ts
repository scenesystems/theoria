/**
 * RFC 8785 JSON Canonicalization Scheme (JCS).
 *
 * Deterministic JSON serialization guaranteeing cross-language byte
 * identity for structured data before hashing. This is the sole
 * canonicalization strategy across the Theoria ecosystem —
 * `effect-search` cache keys, `effect-dsp` signature fingerprints,
 * and content-addressing all pass through this function.
 *
 * **RFC 8785 rules applied:**
 * - Object keys sorted lexicographically by UTF-16 code units
 * - Numbers use ES2015 canonical representation (no trailing zeros,
 *   no positive sign, shortest representation)
 * - No whitespace between tokens
 * - No BOM
 * - `null` is preserved; `undefined` is rejected
 * - Nested objects and arrays are recursed
 *
 * Returns a canonical JSON string. Callers compose with
 * {@link blake3Hash} or {@link sha256} for the full digest pipeline.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8785
 * @see {@link digest} — unified pipeline: canonicalize → encode → hash → base64url
 * @see {@link durableFingerprint} — Effect-wrapped canonical fingerprinting
 *
 * @since 0.1.0
 * @category canonicalization
 */

import { Effect, Either } from "effect"
import { canonicalizeValue } from "./internal/jcs.js"
import type { FingerprintUnsupportedValue } from "./schemas/errors.js"

/**
 * Canonicalize a value to RFC 8785 JCS canonical JSON.
 *
 * Fails with `FingerprintUnsupportedValue` when the value contains
 * types that cannot participate in deterministic serialization.
 *
 * @since 0.1.0
 * @category canonicalization
 */
export const canonicalize = (
  value: unknown
): Effect.Effect<string, FingerprintUnsupportedValue> =>
  Either.match(canonicalizeValue(value), {
    onLeft: (err) => Effect.fail(err),
    onRight: (result) => Effect.succeed(result)
  })
