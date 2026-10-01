/** Hashes bytes and strict UTF-8 text, then composes Effect's wire encoders. */

import { BunRuntime } from "@effect/platform-bun"
import * as Digest from "@scenesystems/digest/Digest"
import * as Utf8 from "@scenesystems/digest/Utf8"
import { Effect, Encoding } from "effect"

const program = Effect.gen(function*() {
  const message = "hello, content hashing!"
  const bytes = yield* Utf8.encode(message)

  const blake3 = Digest.hash("blake3-256", bytes)
  const sha256 = Digest.hash("sha256", bytes)
  yield* Effect.log("BLAKE3", {
    base64url: Encoding.encodeBase64Url(blake3),
    hex: Encoding.encodeHex(blake3)
  })
  yield* Effect.log("SHA-256", {
    base64url: Encoding.encodeBase64Url(sha256),
    hex: Encoding.encodeHex(sha256)
  })

  const strictTextHash = yield* Digest.hashString("blake3-256", message)
  yield* Effect.log("Strict text parity", {
    matches: Encoding.encodeHex(strictTextHash) === Encoding.encodeHex(blake3)
  })
})

BunRuntime.runMain(program)
