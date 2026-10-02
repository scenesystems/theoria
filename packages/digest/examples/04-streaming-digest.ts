/** Hashes byte and text streams while preserving stream failures and services. */

import { BunRuntime } from "@effect/platform-bun"
import * as Digest from "@scenesystems/digest/Digest"
import * as Utf8 from "@scenesystems/digest/Utf8"
import { Effect, Stream } from "effect"
import { Base64Url, Hex } from "effect/encoding"

const program = Effect.gen(function*() {
  const chunks = yield* Effect.all([
    Effect.fromResult(Utf8.encode("stream-")),
    Effect.fromResult(Utf8.encode("safe-")),
    Effect.fromResult(Utf8.encode("digest"))
  ])
  const whole = yield* Effect.fromResult(Utf8.encode("stream-safe-digest"))
  const streamed = yield* Digest.hashStream("blake3-256", Stream.fromIterable(chunks))
  const oneShot = Digest.hash("blake3-256", whole)

  yield* Effect.log("Byte stream parity", {
    streamed: Base64Url.encode(streamed),
    matches: Hex.encode(streamed) === Hex.encode(oneShot)
  })

  const streamedText = yield* Digest.hashStringStream(
    "sha256",
    Stream.fromIterable(["surrogate-", "\uD83D", "\uDE00"])
  )
  const oneShotText = yield* Effect.fromResult(Digest.hashString("sha256", "surrogate-😀"))
  yield* Effect.log("Text stream parity", {
    digest: Hex.encode(streamedText),
    matches: Hex.encode(streamedText) === Hex.encode(oneShotText)
  })
})

BunRuntime.runMain(program)
