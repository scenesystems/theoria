/**
 * Derives an X25519 shared secret from both participants' perspectives and
 * compares the resulting bytes with the package's byte-equality helper. JavaScript
 * runtimes do not provide a constant-time execution guarantee.
 *
 * Run: bun run examples/02-key-agreement.ts
 */

import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import { Bytes, Entropy, X25519 } from "@scenesystems/sign"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const alice = yield* X25519.generateKeyPair()
  const bob = yield* X25519.generateKeyPair()
  yield* Effect.log("Key pairs generated", {
    alicePublicKeyBytes: alice.publicKey.byteLength,
    bobPublicKeyBytes: bob.publicKey.byteLength
  })

  const secretA = yield* X25519.deriveSharedSecret(alice.secretKey, bob.publicKey)
  const secretB = yield* X25519.deriveSharedSecret(bob.secretKey, alice.publicKey)

  yield* Effect.log("Shared secret", {
    algorithm: secretA.algorithm,
    bytes: secretA.sharedSecret.byteLength,
    bothSidesMatch: Bytes.equal(secretA.sharedSecret, secretB.sharedSecret)
  })
}).pipe(Effect.provide(Entropy.layer))

BunRuntime.runMain(program)
