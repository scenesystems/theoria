/**
 * Sealed envelope serialization and deserialization.
 *
 * Handles the binary envelope format used for persisted ciphertext:
 * nonce ‖ ciphertext ‖ authentication tag. The nonce length varies
 * by algorithm and the tag is always 16 bytes.
 *
 * Wraps `base64urlnopad` from `@scure/base` — audited by Cure53,
 * zero-dependency, RFC 4648-compliant — for string serialization
 * of binary envelopes when text transport is needed.
 *
 * Provides:
 * - `encodeEnvelope` — binary envelope to base64url string
 * - `decodeEnvelope` — base64url string to binary envelope
 * - `packEnvelope` — structured `SealedEnvelope` to raw bytes
 * - `unpackEnvelope` — raw bytes to structured `SealedEnvelope`
 *
 * @see {@link SealedEnvelope} — the structured envelope type
 * @see {@link seal} — produces envelopes via the unified pipeline
 * @see {@link xchacha20} — nonce size for XChaCha20-Poly1305
 * @see {@link aesgcmsiv} — nonce size for AES-256-GCM-SIV
 * @see {@link aesgcm} — nonce size for AES-256-GCM
 *
 * @since 0.1.0
 * @category encoding
 */
