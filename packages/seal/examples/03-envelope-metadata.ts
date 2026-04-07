/**
 * Envelope Metadata — transport hints for key selection and rotation.
 *
 * What this shows: metadata stays additive to the sealed envelope. Callers can
 * stamp `keyId` and `keyVersion` for key selection workflows without changing
 * the authenticated ciphertext shape or the decrypt call path.
 *
 * Run: bun run examples/03-envelope-metadata.ts
 */

import { BunRuntime } from "@effect/platform-bun"
import { generateKey, seal, unseal, utf8FromBytes, utf8ToBytes } from "@scenesystems/seal"
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const key = yield* generateKey(32)
  const plaintext = utf8ToBytes("rotate me safely")

  const envelope = yield* seal("xchacha20-poly1305", key, plaintext, {
    keyId: "primary-signing-key",
    keyVersion: 7
  })
  const recovered = yield* unseal(key, envelope)

  return {
    keyId: envelope.keyId,
    keyVersion: envelope.keyVersion,
    text: utf8FromBytes(recovered)
  }
})

BunRuntime.runMain(program)

export default program
