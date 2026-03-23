/**
 * AES-256-GCM algorithm contract tests.
 *
 * Verifies:
 * - Encrypt/decrypt round-trip produces identical plaintext
 * - Different nonces produce different ciphertext for same plaintext
 * - Tampered ciphertext is rejected (authentication failure)
 * - Wrong key is rejected
 * - 32-byte key requirement is enforced
 * - Output contains 12-byte prepended nonce
 * - Empty plaintext is handled correctly
 * - Associated data (AAD) is respected when provided
 */
