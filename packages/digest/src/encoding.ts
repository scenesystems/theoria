/**
 * Base64url encoding and decoding (RFC 4648 §5).
 *
 * Universal digest encoding across the ecosystem. All 256-bit
 * digests encode to base64url strings with no padding.
 *
 * Wraps `base64urlnopad` from `@scure/base` — audited by Cure53,
 * zero-dependency, RFC 4648-compliant. The `@scure/base` package
 * is the Noble ecosystem's sister project for non-cryptographic
 * encoding utilities (4KB gzipped).
 *
 * URL-safe alphabet: `A-Z a-z 0-9 - _` (no `+` `/` `=`).
 *
 * @see {@link blake3Hash} — produces `Uint8Array` that this module encodes
 * @see {@link sha256} — produces `Uint8Array` that this module encodes
 * @see {@link Digest256} — schema enforcing the encoded output shape
 *
 * @since 0.1.0
 * @category encoding
 */
