/**
 * Key length validation per algorithm.
 *
 * All three supported algorithms require 256-bit (32-byte) keys.
 * This module validates key length before passing to
 * `@noble/ciphers` — providing clear error messages rather than
 * opaque noble assertion failures.
 *
 * Validation rules:
 * - Key must be `Uint8Array`
 * - Key must be exactly 32 bytes
 * - Key must not be all-zeros (weak key detection)
 *
 * Private to the package — consumers use the public API.
 *
 * @internal
 */
