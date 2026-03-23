/**
 * Typed errors for digest operations.
 *
 * All errors are `Schema.TaggedError` — yieldable in `Effect.gen`,
 * catchable via `Effect.catchTag`, serializable via Schema.
 *
 * **`FingerprintUnsupportedValue`** — raised when `durableFingerprint`
 * encounters a value that cannot participate in deterministic
 * canonicalization (e.g. `undefined`, `BigInt`, `Symbol`, `Date`,
 * `NaN`, `±Infinity`, `-0`). Carries `valueType` (the `typeof`
 * result) and `reason` (human-readable explanation).
 *
 * ```ts
 * class FingerprintUnsupportedValue extends Schema.TaggedError<
 *   FingerprintUnsupportedValue
 * >()("FingerprintUnsupportedValue", {
 *   valueType: Schema.String,
 *   reason: Schema.String
 * }) {}
 * ```
 *
 * @see {@link durableFingerprint} — the operation that produces this error
 *
 * @since 0.1.0
 * @category errors
 */
