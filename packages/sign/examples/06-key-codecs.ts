import { BunRuntime } from "@effect/platform-bun"
import { Effect } from "effect"

import {
  decodeKeyPair,
  decodeSharedSecret,
  decodeSignature,
  deriveSharedSecret,
  encodeKeyPair,
  encodeSharedSecret,
  encodeSignature,
  equalBytes,
  generateKeyPair,
  sign,
  utf8ToBytes,
  verify
} from "../src/index.js"

const program = Effect.gen(function*() {
  const signingKeys = yield* generateKeyPair("ed25519")
  const portableKeys = encodeKeyPair(signingKeys)
  const restoredKeys = yield* decodeKeyPair(portableKeys)
  const message = utf8ToBytes("portable signature")
  const signature = yield* sign("ed25519", message, restoredKeys.secretKey, restoredKeys.publicKey)
  const portableSignature = encodeSignature(signature)
  const restoredSignature = yield* decodeSignature(portableSignature)

  const alice = yield* generateKeyPair("x25519")
  const bob = yield* generateKeyPair("x25519")
  const sharedSecret = yield* deriveSharedSecret("x25519", alice.secretKey, bob.publicKey)
  const portableSharedSecret = encodeSharedSecret(sharedSecret)
  const restoredSharedSecret = yield* decodeSharedSecret(portableSharedSecret)

  yield* Effect.log("Portable codec workflows", {
    portableSigningPublicKey: portableKeys.publicKey,
    portableSignature,
    signingKeysRoundTrip: equalBytes(signingKeys.publicKey, restoredKeys.publicKey),
    signingSignatureRoundTrip: yield* verify(restoredSignature, message),
    sharedSecretRoundTrip: equalBytes(sharedSecret.sharedSecret, restoredSharedSecret.sharedSecret)
  })
})

BunRuntime.runMain(program)
