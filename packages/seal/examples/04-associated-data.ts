/**
 * Associated Data — authenticate protocol context outside the envelope.
 *
 * What this shows: AAD binds stable protocol context to ciphertext
 * authentication while remaining outside the `SealedEnvelope` itself. Callers
 * must provide the same bytes again during `unseal(...)`.
 *
 * Run: bun run examples/04-associated-data.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import { generateKey, seal, unseal, utf8FromBytes, utf8ToBytes } from "@scenesystems/seal"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const key = yield* generateKey(32)
  const associatedData = utf8ToBytes("workflow-comparison:baseline:v1")
  const plaintext = utf8ToBytes("bind this ciphertext to protocol context")

  const envelope = yield* seal("xchacha20-poly1305", key, plaintext, {}, associatedData)
  const recovered = yield* unseal(key, envelope, associatedData)

  return {
    aadBytes: associatedData.byteLength,
    algorithm: envelope.algorithm,
    text: utf8FromBytes(recovered)
  }
})

BunRuntime.runMain(program)

export default program
