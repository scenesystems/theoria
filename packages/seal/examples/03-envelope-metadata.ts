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

export default program
