/**
 * Public codec helpers for portable cryptographic artifacts.
 *
 * The package-owned cryptographic classes remain the in-memory authority.
 * These helpers bridge them onto portable base64url-safe carriers without
 * exposing internal byte-encoding utilities or introducing PEM/JWK policy.
 *
 * @since 0.2.0
 * @category codecs
 */
import { Effect, Either, Schema } from "effect"
import { fromBase64Url, toBase64Url } from "./encoding.js"
import { PortableCodecDecodeFailed } from "./schemas/errors.js"
import { KemCiphertext } from "./schemas/KemCiphertext.js"
import { KeyPair } from "./schemas/KeyPair.js"
import {
  PortableKemCiphertext,
  PortableKeyPair,
  PortableSharedSecret,
  PortableSignature
} from "./schemas/PortableArtifacts.js"
import { SharedSecret } from "./schemas/SharedSecret.js"
import { Signature } from "./schemas/Signature.js"

type PortableCodecMaterialKindType = "key-pair" | "signature" | "shared-secret" | "kem-ciphertext"

const codecDecodeFailed = (
  material: PortableCodecMaterialKindType,
  error: unknown
): PortableCodecDecodeFailed => new PortableCodecDecodeFailed({ material, reason: String(error) })

const decodePortableValue = <A>(
  schema: Schema.Schema<A>,
  material: PortableCodecMaterialKindType,
  input: unknown
): Effect.Effect<A, PortableCodecDecodeFailed> =>
  Schema.decodeUnknown(schema)(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError((error) => codecDecodeFailed(material, error))
  )

const decodeBase64UrlField = (
  material: PortableCodecMaterialKindType,
  field: string,
  encoded: string
): Effect.Effect<Uint8Array, PortableCodecDecodeFailed> =>
  Either.match(fromBase64Url(encoded), {
    onLeft: (error) => Effect.fail(codecDecodeFailed(material, `${field}: ${String(error)}`)),
    onRight: Effect.succeed
  })

/**
 * Encode a `KeyPair` into a portable base64url carrier.
 *
 * @since 0.2.0
 * @category codecs
 */
export const encodeKeyPair = (keyPair: KeyPair): PortableKeyPair =>
  new PortableKeyPair({
    algorithm: keyPair.algorithm,
    publicKey: toBase64Url(keyPair.publicKey),
    secretKey: toBase64Url(keyPair.secretKey)
  })

/**
 * Decode a portable key-pair carrier back into the in-memory schema class.
 *
 * @since 0.2.0
 * @category codecs
 */
export const decodeKeyPair = (input: unknown): Effect.Effect<KeyPair, PortableCodecDecodeFailed> =>
  Effect.gen(function*() {
    const portable = yield* decodePortableValue(PortableKeyPair, "key-pair", input)
    return new KeyPair({
      algorithm: portable.algorithm,
      publicKey: yield* decodeBase64UrlField("key-pair", "publicKey", portable.publicKey),
      secretKey: yield* decodeBase64UrlField("key-pair", "secretKey", portable.secretKey)
    })
  })

/**
 * Encode a `Signature` into a portable base64url carrier.
 *
 * @since 0.2.0
 * @category codecs
 */
export const encodeSignature = (signature: Signature): PortableSignature =>
  new PortableSignature({
    algorithm: signature.algorithm,
    signature: toBase64Url(signature.signature),
    publicKey: toBase64Url(signature.publicKey)
  })

/**
 * Decode a portable signature carrier back into the in-memory schema class.
 *
 * @since 0.2.0
 * @category codecs
 */
export const decodeSignature = (input: unknown): Effect.Effect<Signature, PortableCodecDecodeFailed> =>
  Effect.gen(function*() {
    const portable = yield* decodePortableValue(PortableSignature, "signature", input)
    return new Signature({
      algorithm: portable.algorithm,
      signature: yield* decodeBase64UrlField("signature", "signature", portable.signature),
      publicKey: yield* decodeBase64UrlField("signature", "publicKey", portable.publicKey)
    })
  })

/**
 * Encode a `SharedSecret` into a portable base64url carrier.
 *
 * @since 0.2.0
 * @category codecs
 */
export const encodeSharedSecret = (sharedSecret: SharedSecret): PortableSharedSecret =>
  new PortableSharedSecret({
    algorithm: sharedSecret.algorithm,
    sharedSecret: toBase64Url(sharedSecret.sharedSecret)
  })

/**
 * Decode a portable shared-secret carrier back into the in-memory schema class.
 *
 * @since 0.2.0
 * @category codecs
 */
export const decodeSharedSecret = (input: unknown): Effect.Effect<SharedSecret, PortableCodecDecodeFailed> =>
  Effect.gen(function*() {
    const portable = yield* decodePortableValue(PortableSharedSecret, "shared-secret", input)
    return new SharedSecret({
      algorithm: portable.algorithm,
      sharedSecret: yield* decodeBase64UrlField("shared-secret", "sharedSecret", portable.sharedSecret)
    })
  })

/**
 * Encode a `KemCiphertext` into a portable base64url carrier.
 *
 * @since 0.2.0
 * @category codecs
 */
export const encodeKemCiphertext = (ciphertext: KemCiphertext): PortableKemCiphertext =>
  new PortableKemCiphertext({
    algorithm: ciphertext.algorithm,
    ciphertext: toBase64Url(ciphertext.ciphertext),
    sharedSecret: toBase64Url(ciphertext.sharedSecret)
  })

/**
 * Decode a portable KEM ciphertext carrier back into the in-memory schema class.
 *
 * @since 0.2.0
 * @category codecs
 */
export const decodeKemCiphertext = (input: unknown): Effect.Effect<KemCiphertext, PortableCodecDecodeFailed> =>
  Effect.gen(function*() {
    const portable = yield* decodePortableValue(PortableKemCiphertext, "kem-ciphertext", input)
    return new KemCiphertext({
      algorithm: portable.algorithm,
      ciphertext: yield* decodeBase64UrlField("kem-ciphertext", "ciphertext", portable.ciphertext),
      sharedSecret: yield* decodeBase64UrlField("kem-ciphertext", "sharedSecret", portable.sharedSecret)
    })
  })
