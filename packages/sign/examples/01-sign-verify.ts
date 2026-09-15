/**
 * Generates an Ed25519 key pair, signs a message, and verifies both the original
 * and a tampered message through the signature's algorithm tag.
 *
 * Run: bun run examples/01-sign-verify.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import { Bytes, Ed25519, Entropy } from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const keys = yield* Ed25519.generateKeyPair()
  yield* Effect.log("Key pair", {
    algorithm: keys.algorithm,
    publicKeyBytes: keys.publicKey.length,
    secretKeyBytes: keys.secretKey.length
  })

  const message = Bytes.fromString("transfer 100 tokens to Alice")
  const sig = yield* Ed25519.sign(message, keys.secretKey, keys.publicKey)
  yield* Effect.log("Signed", {
    algorithm: sig.algorithm,
    signatureBytes: sig.signature.length
  })

  const valid = yield* Ed25519.verify(sig.signature, message, keys.publicKey)
  yield* Effect.log("Verified", { valid })

  const tampered = Bytes.fromString("transfer 999 tokens to Eve")
  const invalid = yield* Ed25519.verify(sig.signature, tampered, keys.publicKey)
  yield* Effect.log("Tampered", { valid: invalid })
}).pipe(Effect.provide(Entropy.layer))

BunRuntime.runMain(program)
