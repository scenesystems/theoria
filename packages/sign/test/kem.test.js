/**
 * Key encapsulation mechanism pipeline contract tests.
 *
 * Verifies:
 * - encapsulate("xwing", publicKey) produces ciphertext + shared secret
 * - decapsulate("xwing", ciphertext, secretKey) recovers same shared secret
 * - Encapsulation roundtrip: encapsulate → decapsulate → identical shared secret
 * - Different key pairs produce different shared secrets
 * - Ciphertext contains both classical and PQ components
 * - KEM key pair types are accepted
 * - Signature key pairs are NOT accepted (wrong family)
 * - Agreement key pairs are NOT accepted (wrong family)
 */
