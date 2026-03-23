/**
 * AES-256-GCM-SIV algorithm contract tests.
 *
 * Verifies:
 * - Encrypt/decrypt round-trip produces identical plaintext
 * - Different nonces produce different ciphertext for same plaintext
 * - Tampered ciphertext is rejected (authentication failure)
 * - Wrong key is rejected
 * - 32-byte key requirement is enforced
 * - Output contains 12-byte prepended nonce
 * - Nonce-misuse resistance: repeated (nonce, plaintext) pairs
 *   produce identical ciphertext but do not leak other plaintexts
 * - Empty plaintext is handled correctly
 */
