/**
 * Derives an X25519 shared secret from both participants' perspectives and
 * compares the resulting bytes with constant-time equality.
 *
 * Run: bun run examples/02-key-agreement.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import { Bytes, Entropy, X25519 } from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const alice = yield* X25519.generateKeyPair()
  const bob = yield* X25519.generateKeyPair()
  yield* Effect.log("Key pairs generated", {
    alicePublicKeyBytes: alice.publicKey.length,
    bobPublicKeyBytes: bob.publicKey.length
  })

  const secretA = yield* X25519.deriveSharedSecret(alice.secretKey, bob.publicKey)
  const secretB = yield* X25519.deriveSharedSecret(bob.secretKey, alice.publicKey)

  yield* Effect.log("Shared secret", {
    algorithm: secretA.algorithm,
    bytes: secretA.sharedSecret.length,
    bothSidesMatch: Bytes.equal(secretA.sharedSecret, secretB.sharedSecret)
  })
}).pipe(Effect.provide(Entropy.layer))

BunRuntime.runMain(program)
