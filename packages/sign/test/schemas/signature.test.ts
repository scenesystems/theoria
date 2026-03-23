/**
 * Schema-layer type contract tests (Effect layer).
 *
 * Verifies:
 * - SignatureAlgorithm Schema validates signature algorithm literals
 * - SignatureAlgorithm Schema rejects "x25519" and "xwing"
 * - AgreementAlgorithm Schema validates "x25519"
 * - AgreementAlgorithm Schema rejects signature algorithms
 * - KemAlgorithm Schema validates "xwing"
 * - KemAlgorithm Schema rejects signature algorithms
 * - KeyPair Schema.Class encodes/decodes roundtrip
 * - Signature Schema.Class encodes/decodes roundtrip
 * - SharedSecret Schema.Class encodes/decodes roundtrip
 * - KemCiphertext Schema.Class encodes/decodes roundtrip
 * - Schema types carry correct _tag discriminants
 * - Uint8Array fields survive JSON serialization (base64url encoding)
 */
