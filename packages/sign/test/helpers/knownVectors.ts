import { ed25519, x25519 } from "@noble/curves/ed25519.js"
import { schnorr, secp256k1 } from "@noble/curves/secp256k1.js"
import { XWing } from "@noble/post-quantum/hybrid.js"
import { ml_dsa44, ml_dsa65, ml_dsa87 } from "@noble/post-quantum/ml-dsa.js"
import {
  slh_dsa_sha2_128f,
  slh_dsa_sha2_128s,
  slh_dsa_sha2_192f,
  slh_dsa_sha2_256f
} from "@noble/post-quantum/slh-dsa.js"
import { Data } from "effect"
import type { AgreementAlgorithm } from "../../src/schemas/AgreementAlgorithm.js"
import type { KemAlgorithm } from "../../src/schemas/KemAlgorithm.js"
import type { SignatureAlgorithm } from "../../src/schemas/SignatureAlgorithm.js"

type SignatureAlgorithmType = typeof SignatureAlgorithm.Type
type AgreementAlgorithmType = typeof AgreementAlgorithm.Type
type KemAlgorithmType = typeof KemAlgorithm.Type

class SignatureKnownVector extends Data.Class<{
  readonly algorithm: SignatureAlgorithmType
  readonly message: Uint8Array
  readonly secretKey: Uint8Array
  readonly publicKey: Uint8Array
  readonly expectedSignature: Uint8Array
}> {}

class AgreementKnownVector extends Data.Class<{
  readonly algorithm: AgreementAlgorithmType
  readonly aliceSecretKey: Uint8Array
  readonly alicePublicKey: Uint8Array
  readonly bobSecretKey: Uint8Array
  readonly bobPublicKey: Uint8Array
  readonly expectedSharedSecret: Uint8Array
}> {}

class KemKnownVector extends Data.Class<{
  readonly algorithm: KemAlgorithmType
  readonly secretKey: Uint8Array
  readonly publicKey: Uint8Array
  readonly ciphertext: Uint8Array
  readonly expectedSharedSecret: Uint8Array
}> {}

const bytesOf = (length: number, start: number): Uint8Array =>
  Uint8Array.from({ length }, (_, index) => (start + index) % 256)

const signatureMessage = new TextEncoder().encode("scene-systems known-answer vector")

export const signatureKnownVectors: ReadonlyArray<SignatureKnownVector> = [
  (() => {
    const secretKey = bytesOf(32, 1)
    return new SignatureKnownVector({
      algorithm: "ed25519",
      message: signatureMessage,
      secretKey,
      publicKey: ed25519.getPublicKey(secretKey),
      expectedSignature: ed25519.sign(signatureMessage, secretKey)
    })
  })(),
  (() => {
    const secretKey = bytesOf(32, 41)
    return new SignatureKnownVector({
      algorithm: "secp256k1-ecdsa",
      message: signatureMessage,
      secretKey,
      publicKey: secp256k1.getPublicKey(secretKey),
      expectedSignature: secp256k1.sign(signatureMessage, secretKey, { extraEntropy: false })
    })
  })(),
  (() => {
    const secretKey = bytesOf(32, 73)
    return new SignatureKnownVector({
      algorithm: "secp256k1-schnorr",
      message: signatureMessage,
      secretKey,
      publicKey: schnorr.getPublicKey(secretKey),
      expectedSignature: schnorr.sign(signatureMessage, secretKey, new Uint8Array(32))
    })
  })(),
  (() => {
    const keyPair = ml_dsa44.keygen(bytesOf(32, 7))
    return new SignatureKnownVector({
      algorithm: "ml-dsa-44",
      message: signatureMessage,
      secretKey: keyPair.secretKey,
      publicKey: keyPair.publicKey,
      expectedSignature: ml_dsa44.sign(signatureMessage, keyPair.secretKey, { extraEntropy: false })
    })
  })(),
  (() => {
    const keyPair = ml_dsa65.keygen(bytesOf(32, 9))
    return new SignatureKnownVector({
      algorithm: "ml-dsa-65",
      message: signatureMessage,
      secretKey: keyPair.secretKey,
      publicKey: keyPair.publicKey,
      expectedSignature: ml_dsa65.sign(signatureMessage, keyPair.secretKey, { extraEntropy: false })
    })
  })(),
  (() => {
    const keyPair = ml_dsa87.keygen(bytesOf(32, 11))
    return new SignatureKnownVector({
      algorithm: "ml-dsa-87",
      message: signatureMessage,
      secretKey: keyPair.secretKey,
      publicKey: keyPair.publicKey,
      expectedSignature: ml_dsa87.sign(signatureMessage, keyPair.secretKey, { extraEntropy: false })
    })
  })(),
  (() => {
    const keyPair = slh_dsa_sha2_128f.keygen(bytesOf(48, 13))
    return new SignatureKnownVector({
      algorithm: "slh-dsa-sha2-128f",
      message: signatureMessage,
      secretKey: keyPair.secretKey,
      publicKey: keyPair.publicKey,
      expectedSignature: slh_dsa_sha2_128f.sign(signatureMessage, keyPair.secretKey, { extraEntropy: false })
    })
  })(),
  (() => {
    const keyPair = slh_dsa_sha2_128s.keygen(bytesOf(48, 17))
    return new SignatureKnownVector({
      algorithm: "slh-dsa-sha2-128s",
      message: signatureMessage,
      secretKey: keyPair.secretKey,
      publicKey: keyPair.publicKey,
      expectedSignature: slh_dsa_sha2_128s.sign(signatureMessage, keyPair.secretKey, { extraEntropy: false })
    })
  })(),
  (() => {
    const keyPair = slh_dsa_sha2_192f.keygen(bytesOf(72, 19))
    return new SignatureKnownVector({
      algorithm: "slh-dsa-sha2-192f",
      message: signatureMessage,
      secretKey: keyPair.secretKey,
      publicKey: keyPair.publicKey,
      expectedSignature: slh_dsa_sha2_192f.sign(signatureMessage, keyPair.secretKey, { extraEntropy: false })
    })
  })(),
  (() => {
    const keyPair = slh_dsa_sha2_256f.keygen(bytesOf(96, 23))
    return new SignatureKnownVector({
      algorithm: "slh-dsa-sha2-256f",
      message: signatureMessage,
      secretKey: keyPair.secretKey,
      publicKey: keyPair.publicKey,
      expectedSignature: slh_dsa_sha2_256f.sign(signatureMessage, keyPair.secretKey, { extraEntropy: false })
    })
  })()
]

const aliceSeed = bytesOf(32, 29)
const bobSeed = bytesOf(32, 61)
const aliceAgreement = x25519.keygen(aliceSeed)
const bobAgreement = x25519.keygen(bobSeed)

export const agreementKnownVector = new AgreementKnownVector({
  algorithm: "x25519",
  aliceSecretKey: aliceAgreement.secretKey,
  alicePublicKey: aliceAgreement.publicKey,
  bobSecretKey: bobAgreement.secretKey,
  bobPublicKey: bobAgreement.publicKey,
  expectedSharedSecret: x25519.getSharedSecret(aliceAgreement.secretKey, bobAgreement.publicKey)
})

const kemKeyPair = XWing.keygen(bytesOf(32, 91))
const kemEncapsulation = XWing.encapsulate(kemKeyPair.publicKey, bytesOf(64, 123))

export const kemKnownVector = new KemKnownVector({
  algorithm: "xwing",
  secretKey: kemKeyPair.secretKey,
  publicKey: kemKeyPair.publicKey,
  ciphertext: kemEncapsulation.cipherText,
  expectedSharedSecret: kemEncapsulation.sharedSecret
})
