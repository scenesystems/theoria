/**
 * Schema-validated seal algorithm literal.
 *
 * `Schema.Literal("xchacha20-poly1305", "aes-256-gcm-siv", "aes-256-gcm")`
 *
 * Runtime-validated version of the core {@link SealAlgorithm} type
 * contract. Provides decode/encode for untrusted inputs (API
 * payloads, persisted configuration, CLI arguments).
 *
 * The literal values match the IANA-style algorithm identifiers
 * used by `@noble/ciphers` and are the canonical algorithm names
 * throughout the Theoria ecosystem.
 *
 * ```ts
 * const SealAlgorithm = Schema.Literal(
 *   "xchacha20-poly1305",
 *   "aes-256-gcm-siv",
 *   "aes-256-gcm"
 * )
 * type SealAlgorithm = typeof SealAlgorithm.Type
 * ```
 *
 * @see {@link SealedEnvelope} — uses this as the algorithm field
 *
 * @since 0.1.0
 * @category schemas
 */
