/**
 * X25519 ECDH key agreement.
 *
 * Elliptic-curve Diffie–Hellman on Curve25519 for deriving shared
 * secrets between two parties. Used for encrypted multi-party
 * optimization channels and secure key exchange.
 *
 * Wraps `@noble/curves/ed25519` (X25519 is the Montgomery form of
 * Curve25519) — audited (Trail of Bits, Cure53), zero-dependency.
 *
 * Implements RFC 7748 (Elliptic Curves for Security). Given two
 * parties' key pairs, produces a 32-byte shared secret that only
 * those two parties can compute.
 *
 * Key sizes:
 * - Secret key: 32 bytes (256 bits)
 * - Public key: 32 bytes (256 bits, u-coordinate)
 * - Shared secret: 32 bytes (256 bits)
 *
 * Security property: Computational Diffie–Hellman (CDH) assumption
 * on Curve25519. 128-bit classical security. The shared secret
 * should be passed through a KDF (e.g., HKDF-BLAKE3) before use
 * as a symmetric key.
 *
 * @see {@link ed25519} — signing on the same curve family
 * @see {@link hybrid} — post-quantum key agreement via XWing
 *
 * @since 0.1.0
 * @category algorithms
 */
