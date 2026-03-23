/**
 * Typed errors for cryptographic operations.
 *
 * All errors are `Schema.TaggedError` — yieldable in `Effect.gen`,
 * catchable via `Effect.catchTag`, serializable via Schema.
 *
 * **`SigningFailed`** — raised when a signing operation fails.
 * Carries `algorithm` and `reason`.
 *
 * ```ts
 * class SigningFailed extends Schema.TaggedError<
 *   SigningFailed
 * >()("SigningFailed", {
 *   algorithm: Schema.String,
 *   reason: Schema.String
 * }) {}
 * ```
 *
 * **`VerificationFailed`** — raised when signature verification does
 * not pass. The signature is well-formed but does not match the
 * message and public key. Carries `algorithm` and `reason`.
 *
 * ```ts
 * class VerificationFailed extends Schema.TaggedError<
 *   VerificationFailed
 * >()("VerificationFailed", {
 *   algorithm: Schema.String,
 *   reason: Schema.String
 * }) {}
 * ```
 *
 * **`InvalidSignature`** — raised when signature data is malformed
 * (wrong length, invalid encoding, corrupted bytes). Carries
 * `algorithm` and `reason`.
 *
 * ```ts
 * class InvalidSignature extends Schema.TaggedError<
 *   InvalidSignature
 * >()("InvalidSignature", {
 *   algorithm: Schema.String,
 *   reason: Schema.String
 * }) {}
 * ```
 *
 * **`KeyGenerationFailed`** — raised when key pair generation fails
 * (insufficient entropy, invalid parameters). Carries `algorithm`
 * and `reason`.
 *
 * ```ts
 * class KeyGenerationFailed extends Schema.TaggedError<
 *   KeyGenerationFailed
 * >()("KeyGenerationFailed", {
 *   algorithm: Schema.String,
 *   reason: Schema.String
 * }) {}
 * ```
 *
 * @see {@link signEffect} — the operations that produce these errors
 *
 * @since 0.1.0
 * @category errors
 */
