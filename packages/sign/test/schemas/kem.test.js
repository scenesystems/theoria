/**
 * KEM schema contract tests (Effect layer).
 *
 * Verifies:
 * - KemAlgorithm Schema validates "xwing"
 * - KemAlgorithm Schema rejects signature and agreement algorithms
 * - KemCiphertext Schema.Class encodes/decodes roundtrip
 * - KemCiphertext carries correct algorithm discriminant
 * - KemCiphertext ciphertext and sharedSecret fields are Uint8Array
 */
