/**
 * Nonce generation and management.
 *
 * Generates cryptographically secure random nonces via
 * `crypto.getRandomValues`. Nonce size is algorithm-dependent —
 * see each algorithm module for the specific nonce length.
 *
 * When using `@noble/ciphers` `managedNonce` wrapper, nonce
 * generation is handled automatically — this module provides
 * standalone nonce utilities for cases where manual nonce
 * management is needed (e.g. deterministic testing).
 *
 * Private to the package — consumers use the public API.
 *
 * @see {@link xchacha20} — 24-byte nonce (192-bit)
 * @see {@link aesgcmsiv} — 12-byte nonce (96-bit)
 * @see {@link aesgcm} — 12-byte nonce (96-bit)
 *
 * @internal
 */
