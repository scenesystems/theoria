/** Hashes bytes and strict UTF-8 text, then composes Effect's wire encoders. */

import { BunRuntime } from "@effect/platform-bun"
import * as Digest from "@scenesystems/digest/Digest"
import * as Utf8 from "@scenesystems/digest/Utf8"
import { Effect } from "effect"
import { Base64Url, Hex } from "effect/encoding"

const program = Effect.gen(function*() {
  const message = "hello, content hashing!"
  const bytes = yield* Effect.fromResult(Utf8.encode(message))

  const blake3 = Digest.hash("blake3-256", bytes)
  const sha256 = Digest.hash("sha256", bytes)
  yield* Effect.log("BLAKE3", {
    base64url: Base64Url.encode(blake3),
    hex: Hex.encode(blake3)
  })
  yield* Effect.log("SHA-256", {
    base64url: Base64Url.encode(sha256),
    hex: Hex.encode(sha256)
  })

  const strictTextHash = yield* Effect.fromResult(Digest.hashString("blake3-256", message))
  yield* Effect.log("Strict text parity", {
    matches: Hex.encode(strictTextHash) === Hex.encode(blake3)
  })
})

BunRuntime.runMain(program)
