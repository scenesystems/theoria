/**
 * Signs and verifies with ML-DSA-65, then confirms that XWing encapsulation and
 * decapsulation derive the same hybrid shared secret.
 *
 * Run: bun run examples/03-post-quantum.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import {
  decapsulate,
  encapsulate,
  equalBytes,
  generateKeyPair,
  mlDsa65SignHedged,
  mlDsa65Verify,
  utf8ToBytes
} from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const sigKeys = yield* generateKeyPair("ml-dsa-65")
  yield* Effect.log("ML-DSA-65 key pair", {
    publicKeyBytes: sigKeys.publicKey.length,
    secretKeyBytes: sigKeys.secretKey.length
  })

  const message = utf8ToBytes("quantum-resistant document signing")
  const context = new Uint8Array(0)
  const entropy32 = crypto.getRandomValues(new Uint8Array(32))
  const sig = yield* mlDsa65SignHedged(message, sigKeys.secretKey, sigKeys.publicKey, context, entropy32)
  const valid = yield* mlDsa65Verify(sig.signature, message, sigKeys.publicKey, context)
  yield* Effect.log("ML-DSA-65 signature", {
    signatureBytes: sig.signature.length,
    verified: valid
  })

  const recipient = yield* generateKeyPair("xwing")
  yield* Effect.log("XWing key pair", {
    publicKeyBytes: recipient.publicKey.length,
    secretKeyBytes: recipient.secretKey.length
  })

  const encap = yield* encapsulate("xwing", recipient.publicKey)
  yield* Effect.log("Encapsulated", {
    ciphertextBytes: encap.ciphertext.length,
    sharedSecretBytes: encap.sharedSecret.length
  })

  const decapSecret = yield* decapsulate("xwing", encap.ciphertext, recipient.secretKey)
  yield* Effect.log("Decapsulated", {
    sharedSecretsMatch: equalBytes(encap.sharedSecret, decapSecret)
  })
})

BunRuntime.runMain(program)
