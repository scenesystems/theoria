/**
 * Signs and verifies with ML-DSA-65, then confirms that XWing encapsulation and
 * decapsulation derive the same hybrid shared secret.
 *
 * Run: bun run examples/03-post-quantum.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import { Bytes, Entropy, MlDsa, XWing } from "@scenesystems/sign"
import { Effect, Encoding } from "effect"

const program = Effect.gen(function*() {
  const sigKeys = yield* MlDsa.generateKeyPair65()
  yield* Effect.log("ML-DSA-65 key pair", {
    publicKeyBytes: sigKeys.publicKey.length,
    secretKeyBytes: sigKeys.secretKey.length
  })

  const message = Bytes.fromString("quantum-resistant document signing")
  const context = yield* Encoding.decodeHex("")
  const entropy32 = yield* Entropy.bytes(MlDsa.entropyBytes)
  const sig = yield* MlDsa.sign65Hedged(message, sigKeys.secretKey, sigKeys.publicKey, context, entropy32)
  const valid = yield* MlDsa.verify65(sig.signature, message, sigKeys.publicKey, context)
  yield* Effect.log("ML-DSA-65 signature", {
    signatureBytes: sig.signature.length,
    verified: valid
  })

  const recipient = yield* XWing.generateKeyPair()
  yield* Effect.log("XWing key pair", {
    publicKeyBytes: recipient.publicKey.length,
    secretKeyBytes: recipient.secretKey.length
  })

  const encap = yield* XWing.encapsulate(recipient.publicKey)
  yield* Effect.log("Encapsulated", {
    ciphertextBytes: encap.ciphertext.length,
    sharedSecretBytes: encap.sharedSecret.length
  })

  const decapSecret = yield* XWing.decapsulate(encap.ciphertext, recipient.secretKey)
  yield* Effect.log("Decapsulated", {
    sharedSecretsMatch: Bytes.equal(encap.sharedSecret, decapSecret)
  })
}).pipe(Effect.provide(Entropy.layer))

BunRuntime.runMain(program)
