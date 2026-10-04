/**
 * Seals and unseals with each public AEAD algorithm, then handles wrong-key and
 * invalid-key-length failures through their typed error tags.
 *
 * Run: bun run examples/02-algorithm-comparison.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import * as Cipher from "@scenesystems/seal/Cipher"
import * as Envelope from "@scenesystems/seal/Envelope"
import { Effect, Schema, String } from "effect"

const program = Effect.gen(function*() {
  const key = yield* Cipher.generateKey
  const plaintext = yield* Schema.decodeEffect(Schema.Uint8ArrayFromHex)("0001027f80ff")

  yield* Effect.forEach(
    Cipher.Algorithm.literals,
    (algorithm) =>
      Effect.gen(function*() {
        const envelope = yield* Envelope.encrypt(algorithm, key, plaintext)
        const recovered = yield* Envelope.decrypt(envelope, key)
        yield* Effect.log(algorithm, {
          nonceChars: envelope.nonce.length,
          ciphertextChars: envelope.ciphertext.length,
          roundTrip: String.Equivalence(
            yield* Schema.encodeEffect(Schema.Uint8ArrayFromHex)(recovered),
            "0001027f80ff"
          )
        })
      }),
    { concurrency: 1 }
  )

  const envelope = yield* Envelope.encrypt("xchacha20-poly1305", key, plaintext)
  const wrongKey = yield* Cipher.generateKey
  const wrongKeyResult = yield* Envelope.decrypt(envelope, wrongKey).pipe(
    Effect.catchTags({
      DecryptionFailed: (e) => Effect.succeed(`caught DecryptionFailed: ${e.reason}`),
      InvalidKey: (e) => Effect.succeed(`caught InvalidKey: expected ${e.expected}, got ${e.received}`)
    })
  )
  yield* Effect.log("Wrong key", { result: wrongKeyResult })

  const badKey = yield* Schema.decodeEffect(Schema.Uint8ArrayFromHex)("00000000000000000000000000000000")
  const badKeyResult = yield* Envelope.encrypt("aes-256-gcm", badKey, plaintext).pipe(
    Effect.catchTag("InvalidKey", (e) => Effect.succeed(`caught InvalidKey: expected ${e.expected}, got ${e.received}`))
  )
  yield* Effect.log("Bad key length", { result: badKeyResult })
}).pipe(Effect.provide(Cipher.layer))

BunRuntime.runMain(program)
