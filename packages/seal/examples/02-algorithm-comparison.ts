/**
 * Algorithm Comparison — all three AEAD algorithms side by side.
 *
 * What this shows: each algorithm produces a self-describing `SealedEnvelope`, and
 * `unseal` dispatches to the correct cipher automatically. Wrong keys and bad key
 * lengths surface as typed errors you can handle with `catchTag`.
 *
 * Run: bun run examples/02-algorithm-comparison.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import type { SealAlgorithm } from "@scenesystems/seal"
import { generateKey, seal, unseal, utf8FromBytes, utf8ToBytes } from "@scenesystems/seal"
import { Effect } from "effect"

const algorithms: Array<typeof SealAlgorithm.Type> = [
  "xchacha20-poly1305",
  "aes-256-gcm-siv",
  "aes-256-gcm"
]

const program = Effect.gen(function*() {
  const key = yield* generateKey(32)
  const plaintext = utf8ToBytes("same message, three algorithms")

  yield* Effect.forEach(
    algorithms,
    (algorithm) =>
      Effect.gen(function*() {
        const envelope = yield* seal(algorithm, key, plaintext)
        const recovered = yield* unseal(key, envelope)
        const text = utf8FromBytes(recovered)
        yield* Effect.log(algorithm, {
          nonceChars: envelope.nonce.length,
          ciphertextChars: envelope.ciphertext.length,
          roundTrip: text === "same message, three algorithms"
        })
      }),
    { concurrency: 1 }
  )

  const envelope = yield* seal("xchacha20-poly1305", key, plaintext)
  const wrongKey = yield* generateKey(32)
  const wrongKeyResult = yield* unseal(wrongKey, envelope).pipe(
    Effect.catchTag("DecryptionFailed", (e) => Effect.succeed(`caught DecryptionFailed: ${e.reason}`)),
    Effect.catchTag("InvalidKey", (e) => Effect.succeed(`caught InvalidKey: expected ${e.expected}, got ${e.received}`))
  )
  yield* Effect.log("Wrong key", { result: wrongKeyResult })

  const badKeyResult = yield* seal("aes-256-gcm", new Uint8Array(16), plaintext).pipe(
    Effect.catchTag("InvalidKey", (e) => Effect.succeed(`caught InvalidKey: expected ${e.expected}, got ${e.received}`))
  )
  yield* Effect.log("Bad key length", { result: badKeyResult })
})

BunRuntime.runMain(program)
