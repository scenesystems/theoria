/**
 * Generates an Ed25519 key pair, signs a message, and verifies both the original
 * and a tampered message through the signature's algorithm tag.
 *
 * Run: bun run examples/01-sign-verify.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import { generateKeyPair, sign, utf8ToBytes, verify } from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const keys = yield* generateKeyPair("ed25519")
  yield* Effect.log("Key pair", {
    algorithm: keys.algorithm,
    publicKeyBytes: keys.publicKey.length,
    secretKeyBytes: keys.secretKey.length
  })

  const message = utf8ToBytes("transfer 100 tokens to Alice")
  const sig = yield* sign("ed25519", message, keys.secretKey, keys.publicKey)
  yield* Effect.log("Signed", {
    algorithm: sig.algorithm,
    signatureBytes: sig.signature.length
  })

  const valid = yield* verify(sig, message)
  yield* Effect.log("Verified", { valid })

  const tampered = utf8ToBytes("transfer 999 tokens to Eve")
  const invalid = yield* verify(sig, tampered)
  yield* Effect.log("Tampered", { valid: invalid })
})

BunRuntime.runMain(program)
