/**
 * Generates an XChaCha20-Poly1305 key, seals plaintext, and recovers the original
 * bytes by dispatching from the envelope's algorithm tag.
 *
 * Run: bun run examples/01-encrypt-decrypt.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import { Cipher, Envelope } from "@scenesystems/seal"
import { Effect, Schema, String } from "effect"

const program = Effect.gen(function*() {
  const key = yield* Cipher.generateKey
  const plaintext = yield* Schema.decodeEffect(Schema.Uint8ArrayFromHex)("0001027f80ff")

  const envelope = yield* Envelope.encrypt("xchacha20-poly1305", key, plaintext)
  yield* Effect.log("Sealed", {
    algorithm: envelope.algorithm,
    nonceLength: envelope.nonce.length,
    ciphertextLength: envelope.ciphertext.length
  })

  const recovered = yield* Envelope.decrypt(envelope, key)
  const hex = yield* Schema.encodeEffect(Schema.Uint8ArrayFromHex)(recovered)
  yield* Effect.log("Unsealed", { hex, roundTrip: String.Equivalence(hex, "0001027f80ff") })
}).pipe(Effect.provide(Cipher.layer))

BunRuntime.runMain(program)
