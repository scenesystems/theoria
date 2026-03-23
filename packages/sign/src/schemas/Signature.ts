/**
 * Algorithm-tagged signature as a Schema.Class.
 *
 * ```ts
 * class Signature extends Schema.Class<Signature>("Signature")({
 *   algorithm: SignatureAlgorithm,
 *   signature: Schema.Uint8ArrayFromSelf,
 *   publicKey: Schema.Uint8ArrayFromSelf
 * }) {}
 * ```
 *
 * Self-describing signature carrying the algorithm tag and the
 * public key used for verification. The algorithm field determines
 * which verification function to dispatch to. Signature sizes vary
 * by algorithm — see each algorithm module for details.
 *
 * @see {@link SignatureAlgorithm} — algorithm discriminant
 * @see {@link ed25519} — Ed25519 signature sizes
 * @see {@link secp256k1} — secp256k1 signature sizes
 * @see {@link mlDsa} — ML-DSA signature sizes
 * @see {@link slhDsa} — SLH-DSA signature sizes
 * @see {@link KeyPair} — what produced this signature
 * @see {@link signEffect} — Effect-wrapped operation producing this type
 *
 * @since 0.1.0
 * @category schemas
 */
