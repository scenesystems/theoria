/**
 * Derives an X25519 shared secret from both participants' perspectives and
 * compares the resulting bytes with constant-time equality.
 *
 * Run: bun run examples/02-key-agreement.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import { deriveSharedSecret, equalBytes, generateKeyPair } from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const alice = yield* generateKeyPair("x25519")
  const bob = yield* generateKeyPair("x25519")
  yield* Effect.log("Key pairs generated", {
    alicePublicKeyBytes: alice.publicKey.length,
    bobPublicKeyBytes: bob.publicKey.length
  })

  const secretA = yield* deriveSharedSecret("x25519", alice.secretKey, bob.publicKey)
  const secretB = yield* deriveSharedSecret("x25519", bob.secretKey, alice.publicKey)

  yield* Effect.log("Shared secret", {
    algorithm: secretA.algorithm,
    bytes: secretA.sharedSecret.length,
    bothSidesMatch: equalBytes(secretA.sharedSecret, secretB.sharedSecret)
  })
})

BunRuntime.runMain(program)
