/**
 * Agreement schema contract tests (Effect layer).
 *
 * Verifies:
 * - AgreementAlgorithm Schema validates "x25519"
 * - AgreementAlgorithm Schema rejects signature and KEM algorithms
 * - SharedSecret Schema.Class encodes/decodes roundtrip
 * - SharedSecret carries correct algorithm discriminant
 * - SharedSecret sharedSecret field is Uint8Array
 */
