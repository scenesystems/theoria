/**
 * KEM encapsulation output as a Schema.Class.
 *
 * ```ts
 * class KemCiphertext extends Schema.Class<KemCiphertext>("KemCiphertext")({
 *   algorithm: KemAlgorithm,
 *   ciphertext: Schema.Uint8ArrayFromSelf,
 *   sharedSecret: Schema.Uint8ArrayFromSelf
 * }) {}
 * ```
 *
 * Carries the encapsulated ciphertext and shared secret from
 * a KEM operation (XWing). The ciphertext is sent to the recipient,
 * who decapsulates it with their secret key to recover the same
 * shared secret. The ciphertext contains both classical and
 * post-quantum components.
 *
 * @see {@link KemAlgorithm} — algorithm discriminant
 * @see {@link kem} — the pipeline that produces this type (KDF guidance)
 *
 * @since 0.1.0
 * @category schemas
 */
