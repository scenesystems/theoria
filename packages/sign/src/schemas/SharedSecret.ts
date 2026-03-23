/**
 * Key agreement output as a Schema.Class.
 *
 * ```ts
 * class SharedSecret extends Schema.Class<SharedSecret>("SharedSecret")({
 *   algorithm: AgreementAlgorithm,
 *   sharedSecret: Schema.Uint8ArrayFromSelf
 * }) {}
 * ```
 *
 * Carries the 32-byte shared secret derived from X25519 key
 * agreement, tagged with the algorithm that produced it.
 *
 * @see {@link AgreementAlgorithm} — algorithm discriminant
 * @see {@link agreement} — the pipeline that produces this type (KDF guidance)
 *
 * @since 0.1.0
 * @category schemas
 */
