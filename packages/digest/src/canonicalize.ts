/**
 * RFC 8785 JSON canonicalization for JSON-visible data.
 *
 * @remarks
 * Object keys use UTF-16 lexical order and numbers use the ECMAScript shortest
 * representation. The encoder emits no whitespace or byte-order mark. Strings
 * and keys must contain well-formed Unicode and are not normalized. Records are
 * traversed through own enumerable string keys and arrays through dense elements;
 * descriptors and prototypes are not inspected.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8785
 * @see {@link digest}
 * @see {@link durableFingerprint}
 *
 * @since 0.1.0
 * @category canonicalization
 * @module
 */

import type { Effect } from "effect"
import { canonicalizeValue } from "./internal/jcs.js"
import type { CanonicalizationError } from "./schemas/errors.js"

/**
 * Serializes admitted JSON-visible data as RFC 8785 canonical JSON.
 *
 * @remarks
 * The admitted domain is finite JSON primitives, dense array elements, and record
 * values traversed through their own enumerable string keys. Inherited,
 * non-enumerable, and symbol-keyed record fields and non-element array properties
 * are ignored. Property and element values are read normally; the input graph must
 * remain stable until the Effect completes.
 *
 * Canonical traversal is stack-safe and yields between bounded batches. Key
 * discovery and sorting for an individual record and the final string join are
 * synchronous and are not bounded interruption points. Interruption publishes no
 * partial output. Every execution keeps mutable traversal state invocation-local;
 * this does not promise that an Effect retained by its caller forgets the input
 * captured by its closure.
 *
 * Unsupported runtime values, malformed Unicode, and cycles fail through the
 * closed `CanonicalizationError` union. Errors contain no rejected values, text,
 * keys, paths, or canonical preimages. Use the caller's actual Schema encoder
 * before canonicalization when runtime data is not already in its intended JSON
 * representation.
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
