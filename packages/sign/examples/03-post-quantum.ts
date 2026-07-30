/**
 * Post-Quantum Cryptography — ML-DSA signatures and XWing KEM.
 *
 * What this shows: ML-DSA-65 (FIPS 204) for post-quantum digital signatures and
 * XWing (X25519 + ML-KEM-768) for hybrid key encapsulation. Both operations are
 * fast enough for interactive use. SLH-DSA is omitted here because it takes 1–5
 * seconds per signing operation — see the test suite for coverage.
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
