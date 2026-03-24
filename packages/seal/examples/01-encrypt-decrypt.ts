/**
 * Encrypt and Decrypt — core seal/unseal workflow.
 *
 * What this shows: the simplest end-to-end encryption round-trip. Generate a key,
 * seal plaintext with XChaCha20-Poly1305, then unseal to recover the original bytes.
 * The envelope carries the algorithm tag, so `unseal` needs only the key.
 *
 * Run: bun run examples/01-encrypt-decrypt.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import { generateKey, seal, unseal, utf8FromBytes, utf8ToBytes } from "@scenesystems/seal"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const key = yield* generateKey(32)
  const plaintext = utf8ToBytes("hello, authenticated encryption!")

  const envelope = yield* seal("xchacha20-poly1305", key, plaintext)
  yield* Effect.log("Sealed", {
    algorithm: envelope.algorithm,
    nonceLength: envelope.nonce.length,
    ciphertextLength: envelope.ciphertext.length
  })

  const recovered = yield* unseal(key, envelope)
  const text = utf8FromBytes(recovered)
  yield* Effect.log("Unsealed", { text, roundTrip: text === "hello, authenticated encryption!" })
})

BunRuntime.runMain(program)
