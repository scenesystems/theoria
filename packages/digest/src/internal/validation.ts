/**
 * Input validation for digest operations.
 *
 * Guards against values that cannot participate in deterministic
 * canonicalization:
 *
 * - `undefined` — not representable in JSON
 * - `BigInt` — must be schema-encoded as string first
 * - `Symbol` — not serializable
 * - `Function` — not serializable
 * - `Date` — must be schema-encoded as ISO string first
 * - `Uint8Array` / `Int8Array` — must be schema-encoded as
 *   base64url string first
 * - `NaN`, `±Infinity`, `-0` — not finite / not deterministic
 *
 * Used by both the core `canonicalize` function (which returns
 * error values) and the schema layer `durableFingerprint` (which
 * returns typed `Effect` errors).
 *
 * @internal
 */
