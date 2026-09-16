/**
 * Generates an XChaCha20-Poly1305 key, seals plaintext, and recovers the original
 * bytes by dispatching from the envelope's algorithm tag.
 *
 * Run: bun run examples/01-encrypt-decrypt.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import { Cipher, Envelope } from "@scenesystems/seal"
import { Array, Effect, Encoding, Schema, String } from "effect"

const program = Effect.gen(function*() {
  const key = yield* Cipher.generateKey
  const plaintext = yield* Schema.decode(Schema.Uint8Array)(Array.make(0, 1, 2, 127, 128, 255))

  const envelope = yield* Envelope.encrypt("xchacha20-poly1305", key, plaintext)
  yield* Effect.log("Sealed", {
    algorithm: envelope.algorithm,
    nonceLength: envelope.nonce.length,
    ciphertextLength: envelope.ciphertext.length
  })

  const recovered = yield* Envelope.decrypt(envelope, key)
  const hex = Encoding.encodeHex(recovered)
  yield* Effect.log("Unsealed", { hex, roundTrip: String.Equivalence(hex, "0001027f80ff") })
}).pipe(Effect.provide(Cipher.layer))

BunRuntime.runMain(program)
