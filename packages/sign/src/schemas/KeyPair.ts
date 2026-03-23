/**
 * Algorithm-tagged key pair as a Schema.Class.
 *
 * ```ts
 * class KeyPair extends Schema.Class<KeyPair>("KeyPair")({
 *   algorithm: SignatureAlgorithm,
 *   publicKey: Schema.Uint8ArrayFromSelf,
 *   secretKey: Schema.Uint8ArrayFromSelf
 * }) {}
 * ```
 *
 * Runtime-validated key pair carrying the algorithm discriminant.
 * The `algorithm` field determines which operations are valid —
 * an Ed25519 key pair cannot be used with ML-DSA signing.
 *
 * Secret keys are `Uint8Array` — serialization to/from base64url
 * or hex is handled by {@link keyEncoding} in the internal layer.
 * Schema encoding/decoding transforms handle serialization for
 * persistence and transport.
 *
 * @see {@link SignatureAlgorithm} — algorithm discriminant
 * @see {@link Signature} — what this key pair produces
 * @see {@link generateKeyPair} — produces instances of this type
 *
 * @since 0.1.0
 * @category schemas
 */
