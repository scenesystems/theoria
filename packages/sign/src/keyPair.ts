/**
 * Key generation and key pair management.
 *
 * Generates cryptographic key pairs for all supported signature and
 * key agreement algorithms. Key generation uses the platform CSPRNG
 * (`crypto.getRandomValues`) via `@noble/curves` and
 * `@noble/post-quantum` internal randomness.
 *
 * Key pair structure:
 * - `algorithm` — which algorithm this key pair is for
 * - `publicKey` — the public verification/agreement key (Uint8Array)
 * - `secretKey` — the secret signing/agreement key (Uint8Array)
 *
 * Post-quantum keys are much larger than classical — this is the
 * fundamental tradeoff for quantum resistance.
 *
 * @see {@link ed25519} — Ed25519 key sizes and algorithm details
 * @see {@link secp256k1} — secp256k1 key sizes and algorithm details
 * @see {@link x25519} — X25519 key sizes and algorithm details
 * @see {@link mlDsa} — ML-DSA key sizes and algorithm details
 * @see {@link slhDsa} — SLH-DSA key sizes and algorithm details
 * @see {@link sign} — uses key pairs for signing operations
 *
 * @since 0.1.0
 * @category keys
 */
