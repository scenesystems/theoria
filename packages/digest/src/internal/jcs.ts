/**
 * RFC 8785 JCS implementation internals.
 *
 * Recursive canonical JSON serializer implementing the full
 * RFC 8785 specification:
 *
 * - Object keys sorted by UTF-16 code unit order (not locale)
 * - ES2015 number serialization (shortest representation,
 *   no positive sign, no trailing zeros)
 * - Nested object/array recursion
 * - `null` preserved as literal
 * - Non-JSON-safe values rejected: `undefined`, `BigInt`,
 *   `Symbol`, `Function`, `Date` (must be pre-encoded),
 *   `Uint8Array` (must be pre-encoded), `NaN`, `±Infinity`, `-0`
 *
 * No external canonicalization library is used — the spec is
 * small (~10 pages) and we control the implementation for
 * auditability and determinism guarantees.
 *
 * @internal
 */
