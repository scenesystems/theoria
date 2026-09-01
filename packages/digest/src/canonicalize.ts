/**
 * RFC 8785 JSON Canonicalization Scheme (JCS).
 *
 * Deterministic JSON serialization for structured data before hashing.
 *
 * **RFC 8785 rules applied:**
 * - Object keys sorted lexicographically by UTF-16 code units
 * - Numbers use ES2015 canonical representation (no trailing zeros,
 *   no positive sign, shortest representation)
 * - No whitespace between tokens
 * - No BOM
 * - `null` is preserved; `undefined` is rejected
 * - Nested objects and arrays are serialized by an explicit stack-safe machine
 *
 * Strings and object keys must be well-formed Unicode and are preserved without
 * normalization. Property accessors and unsupported reflection are rejected;
 * getters are never evaluated. Callers compose the canonical JSON string with
 * {@link blake3Hash} or {@link sha256} for the full digest pipeline.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8785
 * @see {@link digest} — unified pipeline: canonicalize → encode → hash → base64url
 * @see {@link durableFingerprint} — Effect-wrapped canonical fingerprinting
 *
 * @since 0.1.0
 * @category canonicalization
 */

import type { Effect } from "effect"
import { canonicalizeValue } from "./internal/jcs.js"
import type { CanonicalizationError } from "./schemas/errors.js"

/**
 * Canonicalize a value to RFC 8785 JCS canonical JSON.
 *
 * @remarks
 * The admitted domain is finite JSON primitives, dense arrays, and plain data
 * records. Traversal is stack-safe, deterministic, and cooperative in fixed-size
 * Effect batches. The input graph must remain quiescent throughout execution;
 * interruption publishes no partial output. Values outside that domain fail with
 * the closed, bounded `CanonicalizationError` union.
 *
 * Package-owned references to input arrays, symbol descriptor values, descriptor
 * snapshots, and traversal arrays are scoped to one invocation. They are not
 * cached, interned, registered, published, included in returned errors, text, or
 * bytes, or retained after completion or interruption. Symbol-keyed data values
 * are neither read nor traversed. This ownership guarantee makes no claim about
 * when the host garbage collector reclaims otherwise unreachable values.
 *
 * @param value - Value to admit and serialize; it must remain unchanged until the Effect completes.
 * @returns Canonical JSON, or a closed structural, Unicode, or cycle error.
 *
 * @since 0.1.0
 * @category canonicalization
 */
export const canonicalize = (
  value: unknown
): Effect.Effect<string, CanonicalizationError> => canonicalizeValue(value)
