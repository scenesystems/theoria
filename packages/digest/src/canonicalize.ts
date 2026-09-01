/**
 * RFC 8785 JSON canonicalization for strict plain data.
 *
 * Object keys use UTF-16 lexical order and numbers use the ECMAScript shortest
 * representation. The encoder emits no whitespace or byte-order mark. Strings
 * and keys must contain well-formed Unicode and are not normalized. Accessor
 * properties are rejected without invoking their getters.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8785
 * @see {@link digest}
 * @see {@link durableFingerprint}
 *
 * @since 0.1.0
 * @category canonicalization
 */

import type { Effect } from "effect"
import { canonicalizeValue } from "./internal/jcs.js"
import type { CanonicalizationError } from "./schemas/errors.js"

/**
 * Serializes admitted plain data as RFC 8785 canonical JSON.
 *
 * @remarks
 * The admitted domain is finite JSON primitives, dense arrays, and plain data
 * records. Traversal is stack-safe and yields between bounded batches. The input
 * graph must not change before the Effect completes. Interruption publishes no
 * partial output. Values outside the domain fail through the closed
 * `CanonicalizationError` union.
 *
 * The operation does not retain input references after completion or
 * interruption, and returned errors do not contain rejected values.
 * Symbol-keyed properties are not read or traversed.
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
