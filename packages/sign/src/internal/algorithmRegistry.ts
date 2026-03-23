/**
 * Algorithm dispatch registry.
 *
 * Maps algorithm discriminants to their concrete implementations
 * from `@noble/curves` and `@noble/post-quantum`. The unified
 * pipelines ({@link sign}, {@link agreement}, {@link kem}) dispatch
 * through this registry.
 *
 * Three registry sections:
 *
 * **Signature entries** provide:
 * - `sign(message, secretKey)` → signature bytes
 * - `verify(signature, message, publicKey)` → boolean
 * - `generateKeyPair()` → `{ publicKey, secretKey }`
 * - `keyLengths` — expected byte lengths for validation
 *
 * **Agreement entries** provide:
 * - `deriveSharedSecret(secretKey, publicKey)` → 32-byte shared secret
 * - `generateKeyPair()` → `{ publicKey, secretKey }`
 *
 * **KEM entries** provide:
 * - `encapsulate(publicKey)` → `{ ciphertext, sharedSecret }`
 * - `decapsulate(ciphertext, secretKey)` → shared secret
 * - `generateKeyPair()` → `{ publicKey, secretKey }`
 *
 * Private to the package — consumers use the public API.
 *
 * @internal
 */
