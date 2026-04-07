/**
 * Portable, base64url-safe codec carriers for cryptographic artifacts.
 *
 * These schemas keep algorithm discrimination explicit while translating raw
 * byte-bearing artifacts onto JSON-safe strings suitable for storage, wire
 * transport, and app-level persistence.
 *
 * @since 0.2.0
 * @category schemas
 */
import { Schema } from "effect"
import { AgreementAlgorithm } from "./AgreementAlgorithm.js"
import { KemAlgorithm } from "./KemAlgorithm.js"
import { CryptoAlgorithm } from "./KeyPair.js"
import { SignatureAlgorithm } from "./SignatureAlgorithm.js"

const Base64UrlText = Schema.String.pipe(Schema.minLength(1), Schema.pattern(/^[A-Za-z0-9_-]+$/))

/**
 * The portable artifact kinds used by codec helpers and typed decode failures.
 *
 * @since 0.2.0
 * @category schemas
 */
export const PortableCodecMaterialKind = Schema.Literal("key-pair", "signature", "shared-secret", "kem-ciphertext")

/**
 * JSON-safe, base64url-encoded key-pair carrier.
 *
 * @since 0.2.0
 * @category schemas
 */
export class PortableKeyPair extends Schema.Class<PortableKeyPair>("PortableKeyPair")({
  algorithm: CryptoAlgorithm,
  publicKey: Base64UrlText,
  secretKey: Base64UrlText
}) {}

/**
 * JSON-safe, base64url-encoded signature carrier.
 *
 * @since 0.2.0
 * @category schemas
 */
export class PortableSignature extends Schema.Class<PortableSignature>("PortableSignature")({
  algorithm: SignatureAlgorithm,
  signature: Base64UrlText,
  publicKey: Base64UrlText
}) {}

/**
 * JSON-safe, base64url-encoded shared-secret carrier.
 *
 * @since 0.2.0
 * @category schemas
 */
export class PortableSharedSecret extends Schema.Class<PortableSharedSecret>("PortableSharedSecret")({
  algorithm: AgreementAlgorithm,
  sharedSecret: Base64UrlText
}) {}

/**
 * JSON-safe, base64url-encoded KEM ciphertext carrier.
 *
 * @since 0.2.0
 * @category schemas
 */
export class PortableKemCiphertext extends Schema.Class<PortableKemCiphertext>("PortableKemCiphertext")({
  algorithm: KemAlgorithm,
  ciphertext: Base64UrlText,
  sharedSecret: Base64UrlText
}) {}
